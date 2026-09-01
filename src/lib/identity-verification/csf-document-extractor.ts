import "server-only";

import { createCanvas, loadImage } from "@napi-rs/canvas";
import jsQR from "jsqr";
import { createWorker } from "tesseract.js";

import {
  extractCsfDataFromText,
  finalizeCsfAnalysis,
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

async function rasterFromImage(bytes: Uint8Array): Promise<Raster> {
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

async function extractPdf(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({ data: bytes, useSystemFonts: true });
  const document = await loadingTask.promise;
  try {
    const page = await document.getPage(1);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) =>
        "str" in item ? `${item.str}${item.hasEOL ? "\n" : " "}` : "",
      )
      .join("");
    const annotations = await page.getAnnotations();
    const annotationUrls = annotations
      .map((annotation) =>
        "url" in annotation && typeof annotation.url === "string"
          ? annotation.url
          : null,
      )
      .filter((url): url is string => Boolean(url));
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(
      2,
      2200 / Math.max(baseViewport.width, baseViewport.height),
      Math.sqrt(4_000_000 / (baseViewport.width * baseViewport.height)),
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
      text,
      annotationUrls,
      raster: {
        data: imageData.data,
        width: imageData.width,
        height: imageData.height,
        png: canvas.toBuffer("image/png"),
      } satisfies Raster,
    };
  } finally {
    document.cleanup();
    await loadingTask.destroy();
  }
}

function detectQr(raster: Raster, annotationUrls: string[]): CsfQrDetection {
  if (raster.data.length !== raster.width * raster.height * 4) {
    return { status: "UNREADABLE" };
  }
  const decoded = jsQR(raster.data, raster.width, raster.height, {
    inversionAttempts: "attemptBoth",
  });
  const payload =
    decoded?.data || annotationUrls.find((url) => url.startsWith("https://"));
  return payload ? { status: "DECODED", payload } : { status: "UNREADABLE" };
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
  CsfAutomaticAnalysis & { extractionSource: string; confidence: number | null }
> {
  const pdf = input.mimeType === "application/pdf";
  const source = pdf ? await extractPdf(input.bytes) : null;
  const raster = source?.raster ?? (await rasterFromImage(input.bytes));
  let text = source?.text.trim() ?? "";
  let confidence: number | null = text ? 100 : null;
  const extractionSource = text ? "PDF_TEXT" : "OCR";
  if (!text) {
    const ocr = await recognizeText(raster.png);
    text = ocr.text;
    confidence = ocr.confidence;
  }
  const extracted = extractCsfDataFromText(text, input.legalType);
  const result = finalizeCsfAnalysis({
    registeredRfc: input.registeredRfc,
    registeredName: input.registeredName,
    extracted,
    qr: detectQr(raster, source?.annotationUrls ?? []),
  });
  return { ...result, extractionSource, confidence };
}
