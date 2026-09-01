import "server-only";

import {
  analyzeAddressProof,
  normalizeDocumentValue,
  type AutomaticReviewResult,
} from "@/lib/identity-verification/document-analysis";
import { extractEmbeddedPdfText } from "@/lib/identity-verification/csf-document-extractor";
import type { PartnerLegalType } from "@/lib/marketplace/partner-rules";
import type { Json } from "@/types/database.types";

export type AddressProofDocumentAnalysis = {
  result: AutomaticReviewResult;
  warningCodes: string[];
  documentType: string | null;
  extractedName: string | null;
  extractedAddress: string | null;
  extractedDate: string | null;
  normalizedOutput: Json;
};

const monthNames: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

function clean(value: string | null | undefined) {
  return (
    value
      ?.replace(/\s+/g, " ")
      .trim()
      .replace(/^[:\-]+|[;|]+$/g, "") || null
  );
}

function lines(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function afterLabel(text: string, labels: RegExp[]) {
  const rows = lines(text);
  for (const row of rows) {
    for (const label of labels) {
      const match = row.match(label);
      if (match?.[1] && clean(match[1])) return clean(match[1]);
    }
  }
  const flattened = text.replace(/\s+/g, " ");
  for (const label of labels) {
    const match = flattened.match(label);
    if (match?.[1] && clean(match[1])) return clean(match[1]);
  }
  return null;
}

function detectType(text: string) {
  const normalized = normalizeDocumentValue(text) ?? "";
  if (/cfe|electricidad|recibo de luz|suministro/.test(normalized))
    return "electricity";
  if (/agua|siapa|sacmex|comision de agua/.test(normalized)) return "water";
  if (/gas natural|gas lp|naturgy|caligas/.test(normalized)) return "gas";
  if (/telmex|izzi|totalplay|internet|telefonia fija/.test(normalized))
    return "fixed_internet_or_telephone";
  if (
    /estado de cuenta|banco|bbva|banorte|santander|hsbc|citibanamex/.test(
      normalized,
    )
  )
    return "bank_statement";
  return null;
}

function parseDate(text: string) {
  const numeric = text.match(
    /\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b|\b(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})\b/,
  );
  if (numeric) {
    const day = Number(numeric[1] ?? numeric[6]);
    const month = Number(numeric[2] ?? numeric[5]);
    const year = Number(numeric[3] ?? numeric[4]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
      ? date
      : null;
  }
  const named = text
    .toLowerCase()
    .match(/\b(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})\b/);
  if (!named) return null;
  const month = monthNames[normalizeDocumentValue(named[2]) ?? ""];
  if (!month) return null;
  return new Date(Date.UTC(Number(named[3]), month - 1, Number(named[1])));
}

function normalizeAddress(value: string | null) {
  return (normalizeDocumentValue(value) ?? "")
    .replace(/avenida/g, "av")
    .replace(/calle/g, "cl")
    .replace(/colonia/g, "col");
}

function compareAddress(
  documentAddress: string | null,
  registeredAddress: string,
) {
  if (!documentAddress || !registeredAddress) return null;
  const a = normalizeAddress(documentAddress);
  const b = normalizeAddress(registeredAddress);
  if (!a || !b) return null;
  const postalA = documentAddress.match(/\b\d{5}\b/)?.[0];
  const postalB = registeredAddress.match(/\b\d{5}\b/)?.[0];
  if (postalA && postalB && postalA !== postalB) return false;
  const tokens = b.split(/\s+/).filter((token) => token.length > 3);
  const matches = tokens.filter((token) => a.includes(token)).length;
  if (matches >= Math.max(2, Math.ceil(tokens.length * 0.45))) return true;
  return false;
}

async function extractText(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "application/pdf") {
    const pdf = await extractEmbeddedPdfText(bytes);
    return {
      text: pdf.text,
      source: "PDF_TEXT",
      pagesInspected: pdf.pagesInspected,
      ocrUsed: false,
    };
  }
  const [{ createCanvas, loadImage }, { createWorker }, languageData] =
    await Promise.all([
      import("@napi-rs/canvas"),
      import("tesseract.js"),
      import("@tesseract.js-data/spa"),
    ]);
  const image = await loadImage(Buffer.from(bytes));
  const scale = Math.min(1, 2200 / Math.max(image.width, image.height));
  const canvas = createCanvas(
    Math.max(1, Math.round(image.width * scale)),
    Math.max(1, Math.round(image.height * scale)),
  );
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const worker = await createWorker(languageData.default.code, 1, {
    cacheMethod: "none",
    gzip: languageData.default.gzip,
    langPath: languageData.default.langPath,
  });
  try {
    const result = await worker.recognize(canvas.toBuffer("image/png"));
    return {
      text: result.data.text,
      source: "OCR",
      pagesInspected: 1,
      ocrUsed: true,
      confidence: result.data.confidence,
    };
  } finally {
    await worker.terminate();
  }
}

export async function analyzeAddressProofDocument(input: {
  bytes: Uint8Array;
  mimeType: string;
  legalType: PartnerLegalType;
  registeredName: string | null;
  registeredAddress: string;
  now?: Date;
}): Promise<AddressProofDocumentAnalysis> {
  let text = "";
  let source = "UNAVAILABLE";
  let pagesInspected = 0;
  let ocrUsed = false;
  let confidence: number | null = null;
  let runtimeWarning: string | null = null;
  try {
    const extracted = await extractText(input.bytes, input.mimeType);
    text = extracted.text;
    source = extracted.source;
    pagesInspected = extracted.pagesInspected;
    ocrUsed = extracted.ocrUsed;
    confidence = extracted.confidence ?? null;
  } catch {
    runtimeWarning = "DOCUMENT_EXTRACTION_RUNTIME_FAILED";
  }
  const documentType = detectType(text);
  const extractedName = afterLabel(text, [
    /\b(?:titular|nombre del titular|cliente|a nombre de|nombre)\s*[:\-]?\s*(.*)/i,
  ]);
  const extractedAddress = afterLabel(text, [
    /\b(?:domicilio|direcci[oó]n(?: de suministro)?|domicilio de servicio)\s*[:\-]?\s*(.*)/i,
  ]);
  const parsedDate = parseDate(text);
  const registered = input.registeredAddress;
  const addressConsistent = compareAddress(extractedAddress, registered);
  const automatic = analyzeAddressProof({
    legalType: input.legalType,
    documentType,
    documentDate: parsedDate,
    partnerName: input.registeredName ?? "",
    documentName: extractedName,
    addressConsistent,
    now: input.now ?? new Date(),
  });
  const warningCodes = runtimeWarning
    ? [...automatic.warningCodes, runtimeWarning]
    : automatic.warningCodes;
  const result =
    runtimeWarning && automatic.result === "PASSED"
      ? "REVIEW_REQUIRED"
      : automatic.result;
  return {
    result,
    warningCodes,
    documentType,
    extractedName,
    extractedAddress,
    extractedDate: parsedDate?.toISOString().slice(0, 10) ?? null,
    normalizedOutput: {
      extractionSource: source,
      pdfPagesInspected: pagesInspected,
      ocrUsed,
      parseConfidence: confidence,
      addressMatch: addressConsistent,
      nameMatch:
        extractedName && input.registeredName
          ? normalizeDocumentValue(extractedName) ===
            normalizeDocumentValue(input.registeredName)
          : null,
      dateValid: parsedDate
        ? automatic.warningCodes.includes("ADDRESS_PROOF_TOO_OLD") === false
        : null,
    },
  };
}
