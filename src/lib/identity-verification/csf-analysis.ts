import type { AutomaticReviewResult } from "@/lib/identity-verification/document-analysis";
import {
  analyzeFiscalCertificate,
  normalizeDocumentValue,
} from "@/lib/identity-verification/document-analysis";
import type { PartnerLegalType } from "@/lib/marketplace/partner-rules";

const RFC_PATTERN = /\b[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}\b/i;
const RFC_WITH_LAYOUT_GAPS =
  /\b([A-Z&Ñ]{3,4})[\s-]*(\d{6})[\s-]*([A-Z0-9]{3})\b/i;
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

const CSF_FIELD_LABEL =
  /(?:rfc|curp|nombre\s*\(?s\)?|primer\s+apellido|segundo\s+apellido|nombre\s*,?\s*denominaci[oó]n\s+o\s+raz[oó]n\s+social|denominaci[oó]n\s*\/\s*raz[oó]n\s+social|raz[oó]n\s+social|denominaci[oó]n|fecha\s+de\s+inicio|estatus\s+en\s+el\s+padr[oó]n|domicilio\s+fiscal|c[oó]digo\s+postal|tipo\s+de\s+vialidad)/i;

function stripFollowingLabel(value: string) {
  const followingLabel = value.search(
    new RegExp(`\\s+(?=${CSF_FIELD_LABEL.source}\\s*:?)`, "i"),
  );
  return followingLabel >= 0 ? value.slice(0, followingLabel) : value;
}

function valueAfterLabel(text: string, expressions: RegExp[]) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  for (const expression of expressions) {
    for (let index = 0; index < lines.length; index += 1) {
      const match = lines[index]?.match(expression);
      if (!match) continue;
      let candidate = match[1] ?? "";
      if (!candidate.trim()) {
        const nextLine = lines[index + 1];
        if (nextLine && !CSF_FIELD_LABEL.test(nextLine)) candidate = nextLine;
      }
      const value = cleanExtractedValue(stripFollowingLabel(candidate));
      if (value) return value;
    }

    const flattened = text.replace(/\s+/g, " ");
    const match = flattened.match(expression);
    const value = cleanExtractedValue(stripFollowingLabel(match?.[1] ?? ""));
    if (value) return value;
  }
  return null;
}

function extractRfc(text: string) {
  const normalized = text.toUpperCase();
  const direct = normalized.match(RFC_WITH_LAYOUT_GAPS);
  if (direct) return `${direct[1]}${direct[2]}${direct[3]}`;

  const afterLabel = normalized.match(
    /\bRFC\s*:?\s*((?:[A-Z&Ñ0-9]\s*){12,13})\b/i,
  )?.[1];
  if (!afterLabel) return null;
  const compact = afterLabel.replace(/\s+/g, "");
  return RFC_PATTERN.test(compact) ? compact : null;
}

export function extractCsfDataFromText(
  text: string,
  legalType: PartnerLegalType,
): ExtractedCsfData {
  const normalizedText = text.normalize("NFC").replace(/\r/g, "\n");
  const rfc = extractRfc(normalizedText);
  const sharedName = valueAfterLabel(normalizedText, [
    /(?:nombre\s*,?\s*denominaci[oó]n\s*o\s*raz[oó]n\s*social)\s*:?\s*(.*)/i,
  ]);
  if (sharedName) return { rfc, name: sharedName };

  if (legalType === "LEGAL_ENTITY") {
    return {
      rfc,
      name: valueAfterLabel(normalizedText, [
        /(?:denominaci[oó]n\s*\/\s*raz[oó]n\s+social|raz[oó]n\s+social|denominaci[oó]n)\s*:?\s*(.*)/i,
      ]),
    };
  }

  const givenName = valueAfterLabel(normalizedText, [
    /nombre\s*\(?s\)?\s*:?\s*(.*)/i,
  ]);
  const firstSurname = valueAfterLabel(normalizedText, [
    /primer\s+apellido\s*:?\s*(.*)/i,
  ]);
  const secondSurname = valueAfterLabel(normalizedText, [
    /segundo\s+apellido\s*:?\s*(.*)/i,
  ]);
  const composedName = [givenName, firstSurname, secondSurname]
    .filter(Boolean)
    .join(" ");
  return { rfc, name: composedName || null };
}

export function hasUsefulCsfTextSignals(
  text: string,
  legalType: PartnerLegalType,
) {
  const extracted = extractCsfDataFromText(text, legalType);
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const hasCsfLabels =
    /constancia\s+de\s+situacion\s+fiscal|registro\s+federal\s+de\s+contribuyentes|\brfc\b/.test(
      normalized,
    );
  const hasNameLabels =
    legalType === "LEGAL_ENTITY"
      ? /razon\s+social|denominacion/.test(normalized)
      : /nombre\s*\(?s\)?|primer\s+apellido/.test(normalized);
  return {
    extracted,
    hasCsfLabels,
    hasNameLabels,
    useful: Boolean(
      extracted.rfc && extracted.name && hasCsfLabels && hasNameLabels,
    ),
  };
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
