import type { AutomaticReviewResult } from "@/lib/identity-verification/document-analysis";
import {
  analyzeFiscalCertificate,
  normalizeDocumentValue,
} from "@/lib/identity-verification/document-analysis";
import type { PartnerLegalType } from "@/lib/marketplace/partner-rules";

const RFC_PATTERN = /\b[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}\b/i;
const OFFICIAL_SAT_QR_HOST = "siat.sat.gob.mx";
const OFFICIAL_SAT_QR_PATH = "/app/qr/faces/pages/mobile/validadorqr.jsf";

export type CsfQrStatus = "VERIFIED" | "NOT_VERIFIED" | "NOT_AVAILABLE";
export type CsfQrDetection =
  | { status: "DECODED"; payload: string }
  | { status: "UNREADABLE"; payload?: null }
  | { status: "MISSING"; payload?: null };

export type ExtractedCsfData = {
  rfc: string | null;
  name: string | null;
};

export type CsfAutomaticAnalysis = {
  result: AutomaticReviewResult;
  warningCodes: string[];
  extractedRfc: string | null;
  extractedName: string | null;
  officialQrDestination: string | null;
  qrRfc: string | null;
  qrStatus: CsfQrStatus;
  rfcMatches: boolean | null;
  nameMatches: boolean | null;
};

function cleanExtractedValue(value: string | undefined) {
  return (
    value
      ?.replace(/\s+/g, " ")
      .trim()
      .replace(/[|;,]+$/, "") || null
  );
}

function valueAfterLabel(text: string, expressions: RegExp[]) {
  for (const expression of expressions) {
    const match = text.match(expression);
    const value = cleanExtractedValue(match?.[1]);
    if (value) return value;
  }
  return null;
}

export function extractCsfDataFromText(
  text: string,
  legalType: PartnerLegalType,
): ExtractedCsfData {
  const normalizedText = text.replace(/\r/g, "\n");
  const rfc = normalizedText.toUpperCase().match(RFC_PATTERN)?.[0] ?? null;
  const sharedName = valueAfterLabel(normalizedText, [
    /(?:nombre\s*,?\s*denominaci[oó]n\s*o\s*raz[oó]n\s*social)\s*:?\s*([^\n]{3,180})/i,
  ]);
  if (sharedName) return { rfc, name: sharedName };

  if (legalType === "LEGAL_ENTITY") {
    return {
      rfc,
      name: valueAfterLabel(normalizedText, [
        /(?:denominaci[oó]n\s*\/\s*raz[oó]n\s*social|raz[oó]n\s*social|denominaci[oó]n)\s*:?\s*([^\n]{3,180})/i,
      ]),
    };
  }

  const givenName = valueAfterLabel(normalizedText, [
    /nombre\s*\(?s\)?\s*:?\s*([^\n]{2,100})/i,
  ]);
  const firstSurname = valueAfterLabel(normalizedText, [
    /primer\s+apellido\s*:?\s*([^\n]{2,100})/i,
  ]);
  const secondSurname = valueAfterLabel(normalizedText, [
    /segundo\s+apellido\s*:?\s*([^\n]{2,100})/i,
  ]);
  const composedName = [givenName, firstSurname, secondSurname]
    .filter(Boolean)
    .join(" ");
  return { rfc, name: composedName || null };
}

function rfcFromSatQrUrl(url: URL) {
  const encoded = url.searchParams.get("D3") ?? url.searchParams.get("d3");
  if (!encoded) return null;
  const candidates = decodeURIComponent(encoded).toUpperCase().split("_");
  return candidates.find((candidate) => RFC_PATTERN.test(candidate)) ?? null;
}

export function inspectSatQrPayload(payload: string): {
  official: boolean;
  destination: string | null;
  rfc: string | null;
} {
  try {
    const url = new URL(payload.trim());
    const official =
      url.protocol === "https:" &&
      url.hostname.toLowerCase() === OFFICIAL_SAT_QR_HOST &&
      url.pathname === OFFICIAL_SAT_QR_PATH &&
      !url.username &&
      !url.password &&
      url.port === "";
    return {
      official,
      destination: official ? url.toString() : null,
      rfc: official ? rfcFromSatQrUrl(url) : null,
    };
  } catch {
    return { official: false, destination: null, rfc: null };
  }
}

export function finalizeCsfAnalysis(input: {
  registeredRfc: string | null;
  registeredName: string | null;
  extracted: ExtractedCsfData;
  qr: CsfQrDetection;
}): CsfAutomaticAnalysis {
  const inspected =
    input.qr.status === "DECODED"
      ? inspectSatQrPayload(input.qr.payload)
      : { official: false, destination: null, rfc: null };
  const qrWarningCode =
    input.qr.status === "MISSING"
      ? "SAT_QR_MISSING"
      : input.qr.status === "UNREADABLE"
        ? "SAT_QR_UNREADABLE"
        : inspected.official
          ? undefined
          : "SAT_QR_DESTINATION_NOT_OFFICIAL";
  const automatic = analyzeFiscalCertificate({
    registeredRfc: input.registeredRfc,
    registeredName: input.registeredName,
    documentRfc: input.extracted.rfc,
    documentName: input.extracted.name,
    qrOfficialRfc: inspected.rfc,
    qrDestinationIsOfficial: inspected.official,
    qrWarningCode,
  });
  const matches = (registered: string | null, extracted: string | null) =>
    registered && extracted
      ? normalizeDocumentValue(registered) === normalizeDocumentValue(extracted)
      : null;
  return {
    ...automatic,
    extractedRfc: input.extracted.rfc,
    extractedName: input.extracted.name,
    officialQrDestination: inspected.destination,
    qrRfc: inspected.rfc,
    qrStatus: inspected.official
      ? "VERIFIED"
      : input.qr.status === "MISSING"
        ? "NOT_AVAILABLE"
        : "NOT_VERIFIED",
    rfcMatches: matches(input.registeredRfc, input.extracted.rfc),
    nameMatches: matches(input.registeredName, input.extracted.name),
  };
}

export function csfPartnerMessage(result: AutomaticReviewResult) {
  if (result === "PASSED") return "Constancia validada correctamente.";
  if (result === "FAILED") {
    return "Encontramos una diferencia entre tu información fiscal y la constancia. Revisa tus datos o vuelve a cargar el documento correcto.";
  }
  return "No pudimos validar automáticamente toda la constancia. Best Round revisará este documento.";
}
