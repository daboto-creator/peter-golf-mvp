import "server-only";

import {
  extractCsfDataFromText,
  finalizeCsfAnalysis,
  hasUsefulCsfTextSignals,
  inspectSatQrPayload,
  type CsfAutomaticAnalysis,
  type CsfQrDetection,
} from "@/lib/identity-verification/csf-analysis";
import type { PartnerLegalType } from "@/lib/marketplace/partner-rules";

type SpaLanguageData = { code: string; gzip: boolean; langPath: string };

type Raster = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  png: Buffer;
};

type PdfTextSpan = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hasEol: boolean;
};

export type CsfExtractionSource = "PDF_TEXT" | "OCR" | "MIXED";

export type CsfExtractionDiagnostics = {
  pdfPagesInspected: number;
  usefulTextSignalDetected: boolean;
  qrPagesAttempted: number[];
  qrDecoded: boolean;
  ocrUsed: boolean;
  runtimeWarnings?: string[];
};

const MAX_PDF_PAGES = 6;
const PDF_RENDER_MAX_DIMENSION = 3000;
const PDF_RENDER_MAX_PIXELS = 8_000_000;

async function rasterFromImage(bytes: Uint8Array): Promise<Raster> {
  const [{ createCanvas, loadImage }] = await Promise.all([
    import("@napi-rs/canvas"),
  ]);
  const image = await loadImage(Buffer.from(bytes));
  const scale = Math.min(1, 2200 / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  return {
    data: imageData.data,
    width: imageData.width,
    height: imageData.height,
    png: canvas.toBuffer("image/png"),
  };
}

function textFromPdfItems(items: unknown[]) {
  const spans: PdfTextSpan[] = items.flatMap((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      !("str" in item) ||
      typeof item.str !== "string" ||
      !("transform" in item) ||
      !Array.isArray(item.transform)
    ) {
      return [];
    }
    const transform = item.transform as number[];
    return [
      {
        text: item.str,
        x: transform[4] ?? 0,
        y: transform[5] ?? 0,
        width:
          "width" in item && typeof item.width === "number" ? item.width : 0,
        height:
          "height" in item && typeof item.height === "number"
            ? Math.abs(item.height)
            : Math.abs(transform[3] ?? 10),
        hasEol:
          "hasEOL" in item && typeof item.hasEOL === "boolean"
            ? item.hasEOL
            : false,
      },
    ];
  });

  const lines: Array<{ y: number; height: number; spans: PdfTextSpan[] }> = [];
  for (const span of spans.sort(
    (left, right) => right.y - left.y || left.x - right.x,
  )) {
    const line = lines.find(
      (candidate) =>
        Math.abs(candidate.y - span.y) <=
        Math.max(2, Math.min(candidate.height, span.height) * 0.35),
    );
    if (line) {
      line.spans.push(span);
      line.height = Math.max(line.height, span.height);
    } else {
      lines.push({ y: span.y, height: span.height, spans: [span] });
    }
  }

  return lines
    .sort((left, right) => right.y - left.y)
    .map((line) => {
      let rendered = "";
      let previousEnd: number | null = null;
      for (const span of line.spans.sort((left, right) => left.x - right.x)) {
        const gap = previousEnd === null ? 0 : span.x - previousEnd;
        const needsSpace =
          rendered.length > 0 &&
          !/\s$/.test(rendered) &&
          !/^\s/.test(span.text) &&
          gap > Math.max(1.5, line.height * 0.16);
        rendered += `${needsSpace ? " " : ""}${span.text}`;
        previousEnd = Math.max(previousEnd ?? span.x, span.x + span.width);
        if (span.hasEol) rendered += " ";
      }
      return rendered.replace(/\s+/g, " ").trim();
    })
    .filter(Boolean)
    .join("\n");
}

type LoadedPdf = Awaited<ReturnType<typeof loadPdf>>;
type PdfDocument = LoadedPdf["document"];
type PdfPage = Awaited<ReturnType<PdfDocument["getPage"]>>;

async function renderPdfPage(page: PdfPage, scaleLimit = 4): Promise<Raster> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(
    scaleLimit,
    PDF_RENDER_MAX_DIMENSION /
      Math.max(baseViewport.width, baseViewport.height),
    Math.sqrt(
      PDF_RENDER_MAX_PIXELS / (baseViewport.width * baseViewport.height),
    ),
  );
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(
    Math.ceil(viewport.width),
    Math.ceil(viewport.height),
  );
  const context = canvas.getContext("2d");
  await page.render({
    canvas: canvas as never,
    canvasContext: context as never,
    viewport,
  }).promise;
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  return {
    data: imageData.data,
    width: imageData.width,
    height: imageData.height,
    png: canvas.toBuffer("image/png"),
  };
}

async function loadPdf(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
  });
  return {
    document: await loadingTask.promise,
    destroy: () => loadingTask.destroy(),
  };
}

export async function extractEmbeddedPdfText(bytes: Uint8Array) {
  const { document, destroy } = await loadPdf(bytes);
  const pageCount = Math.min(document.numPages, MAX_PDF_PAGES);
  const pageTexts: string[] = [];
  const annotationUrls: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pageTexts.push(textFromPdfItems(content.items));
      const annotations = await page.getAnnotations();
      annotationUrls.push(
        ...annotations.flatMap((annotation) =>
          "url" in annotation && typeof annotation.url === "string"
            ? [annotation.url]
            : [],
        ),
      );
    }
    return {
      text: pageTexts.filter(Boolean).join("\n\n"),
      pagesInspected: pageCount,
      annotationUrls,
    };
  } finally {
    document.cleanup();
    await destroy();
  }
}

async function renderFirstPdfPage(bytes: Uint8Array) {
  const { document, destroy } = await loadPdf(bytes);
  try {
    return await renderPdfPage(await document.getPage(1));
  } finally {
    document.cleanup();
    await destroy();
  }
}

function cropRaster(
  raster: Raster,
  left: number,
  top: number,
  width: number,
  height: number,
) {
  const x0 = Math.max(0, Math.floor(raster.width * left));
  const y0 = Math.max(0, Math.floor(raster.height * top));
  const cropWidth = Math.min(
    raster.width - x0,
    Math.ceil(raster.width * width),
  );
  const cropHeight = Math.min(
    raster.height - y0,
    Math.ceil(raster.height * height),
  );
  const data = new Uint8ClampedArray(cropWidth * cropHeight * 4);
  for (let row = 0; row < cropHeight; row += 1) {
    const sourceStart = ((y0 + row) * raster.width + x0) * 4;
    const sourceEnd = sourceStart + cropWidth * 4;
    data.set(raster.data.subarray(sourceStart, sourceEnd), row * cropWidth * 4);
  }
  return { data, width: cropWidth, height: cropHeight };
}

async function qrPayloadsFromRaster(raster: Raster) {
  const { default: jsQR } = await import("jsqr");
  if (raster.data.length !== raster.width * raster.height * 4) return [];
  const crops = [
    [0, 0, 0.62, 0.62],
    [0.38, 0, 0.62, 0.62],
    [0, 0.38, 0.62, 0.62],
    [0.38, 0.38, 0.62, 0.62],
  ] as const;
  for (const crop of crops) {
    const region = cropRaster(raster, crop[0], crop[1], crop[2], crop[3]);
    const decoded = jsQR(region.data, region.width, region.height, {
      inversionAttempts: "attemptBoth",
    });
    if (decoded?.data) return [decoded.data];
  }
  const decoded = jsQR(raster.data, raster.width, raster.height, {
    inversionAttempts: "attemptBoth",
  });
  return decoded?.data ? [decoded.data] : [];
}

function preferredQrPayload(payloads: string[]) {
  return (
    payloads.find((payload) => inspectSatQrPayload(payload).official) ??
    payloads[0] ??
    null
  );
}

function qrPageOrder(pageCount: number) {
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
  return [1, 3, ...pages].filter(
    (pageNumber, index, values) =>
      pageNumber <= pageCount && values.indexOf(pageNumber) === index,
  );
}

async function extractPdfQr(
  bytes: Uint8Array,
  pageCount: number,
  annotationUrls: string[],
) {
  const { document, destroy } = await loadPdf(bytes);
  try {
    const qrPagesAttempted: number[] = [];
    const decodedPayloads = [...annotationUrls];
    for (const pageNumber of qrPageOrder(pageCount)) {
      const page = await document.getPage(pageNumber);
      const raster = await renderPdfPage(page);
      qrPagesAttempted.push(pageNumber);
      decodedPayloads.push(...(await qrPayloadsFromRaster(raster)));
      const preferred = preferredQrPayload(decodedPayloads);
      if (preferred && inspectSatQrPayload(preferred).official) break;
    }
    const qrPayload = preferredQrPayload(decodedPayloads);
    return {
      qr: qrPayload
        ? ({ status: "DECODED", payload: qrPayload } satisfies CsfQrDetection)
        : ({ status: "MISSING" } satisfies CsfQrDetection),
      qrPagesAttempted,
      qrDecoded: Boolean(qrPayload),
    };
  } finally {
    document.cleanup();
    await destroy();
  }
}

async function recognizeText(png: Buffer) {
  const languageData = (await import("@tesseract.js-data/spa"))
    .default as SpaLanguageData;
  const worker = await createWorker(languageData.code, 1, {
    cacheMethod: "none",
    gzip: languageData.gzip,
    langPath: languageData.langPath,
  });
  try {
    const result = await worker.recognize(png);
    return { text: result.data.text, confidence: result.data.confidence };
  } finally {
    await worker.terminate();
  }
}

export async function analyzeCsfDocument(input: {
  bytes: Uint8Array;
  mimeType: string;
  legalType: PartnerLegalType;
  registeredRfc: string | null;
  registeredName: string | null;
}): Promise<
  CsfAutomaticAnalysis & {
    extractionSource: CsfExtractionSource;
    confidence: number | null;
    diagnostics: CsfExtractionDiagnostics;
  }
> {
  const isPdf = input.mimeType === "application/pdf";
  const runtimeWarnings: string[] = [];
  let pdfText: Awaited<ReturnType<typeof extractEmbeddedPdfText>> | null = null;
  if (isPdf) {
    try {
      pdfText = await extractEmbeddedPdfText(input.bytes);
    } catch {
      runtimeWarnings.push("PDF_LOAD_FAILED");
    }
  }
  const embeddedText = pdfText?.text.trim() ?? "";
  const embeddedSignals = hasUsefulCsfTextSignals(
    embeddedText,
    input.legalType,
  );
  let text = embeddedText;
  let confidence: number | null = embeddedSignals.useful ? 100 : null;
  let extractionSource: CsfExtractionSource = embeddedText ? "PDF_TEXT" : "OCR";
  let ocrUsed = false;
  let qr: CsfQrDetection = { status: "MISSING" };
  let qrPagesAttempted: number[] = [];
  let qrDecoded = false;

  if (!isPdf || !embeddedSignals.useful) {
    try {
      const raster = isPdf
        ? await renderFirstPdfPage(input.bytes)
        : await rasterFromImage(input.bytes);
      const ocr = await recognizeText(raster.png);
      ocrUsed = true;
      confidence = ocr.confidence;
      if (embeddedText) {
        text = `${embeddedText}\n\n${ocr.text}`;
        extractionSource = "MIXED";
      } else {
        text = ocr.text;
        extractionSource = "OCR";
      }
    } catch {
      runtimeWarnings.push("OCR_RUNTIME_UNAVAILABLE");
    }
  }

  if (isPdf && !pdfText && runtimeWarnings.includes("PDF_LOAD_FAILED")) {
    throw new Error("PDF_LOAD_FAILED");
  }

  const extracted = extractCsfDataFromText(text, input.legalType);
  if (isPdf && pdfText) {
    try {
      const qrResult = await extractPdfQr(
        input.bytes,
        pdfText.pagesInspected,
        pdfText.annotationUrls,
      );
      qr = qrResult.qr;
      qrPagesAttempted = qrResult.qrPagesAttempted;
      qrDecoded = qrResult.qrDecoded;
    } catch {
      runtimeWarnings.push("PDF_RENDER_FAILED");
    }
  } else if (!isPdf) {
    try {
      const raster = await rasterFromImage(input.bytes);
      const payload = preferredQrPayload(await qrPayloadsFromRaster(raster));
      qr = payload ? { status: "DECODED", payload } : { status: "MISSING" };
      qrDecoded = Boolean(payload);
    } catch {
      runtimeWarnings.push("CANVAS_RUNTIME_UNAVAILABLE");
    }
  }
  const result = finalizeCsfAnalysis({
    registeredRfc: input.registeredRfc,
    registeredName: input.registeredName,
    extracted,
    qr,
  });
  return {
    ...result,
    extractionSource,
    confidence,
    diagnostics: {
      pdfPagesInspected: pdfText?.pagesInspected ?? 0,
      usefulTextSignalDetected: embeddedSignals.useful,
      qrPagesAttempted,
      qrDecoded: qrDecoded || qr.status === "DECODED",
      ocrUsed,
      runtimeWarnings,
    },
  };
}
const { createWorker } = await import("tesseract.js");
