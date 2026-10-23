import type { BulkIssue, BulkImportType, BulkRowSeverity } from "./types";
import { getFirstPartyBulkPricingReadiness, getPartnerBulkPricingReadiness, hasCanonicalModelYearMismatch } from "./review-policy";

const DERIVED_CODES = new Set([
  "INSUFFICIENT_DATA", "PRICING_REVIEW_REQUIRED", "MISSING_APPROVED_PRICE", "STALE_PRICING",
  "MISSING_ACQUISITION_COST", "AMBIGUOUS_CATEGORY", "UNKNOWN_CATEGORY", "CATEGORY_REQUIRED", "MODEL_YEAR_MISMATCH", "PARTNER_PRICING_REVIEW_REQUIRED", "PARTNER_STALE_PRICING", "PARTNER_MARKET_WARNING",
  "BELOW_FINANCIAL_FLOOR", "MANUAL_MODEL_APPROVED", "MANUAL_MODEL_APPROVAL_REQUIRED",
]);

const MODEL_RESOLUTION_CODES = new Set(["UNKNOWN_MODEL", "AMBIGUOUS_MODEL_GENERATION", "MODEL_SUGGESTION"]);

export function getManualModelResolution(value: Record<string, unknown> | null | undefined, fallback?: Record<string, unknown> | null) {
  const model = value?.model;
  if (model && typeof model === "object") {
    const approved = (model as Record<string, unknown>).approved === true;
    const brand = String((model as Record<string, unknown>).brand ?? "").trim();
    const name = String((model as Record<string, unknown>).model ?? "").trim();
    if (approved && brand && name) return { ...model as Record<string, unknown>, approved: true, brand, model: name };
  }
  // Backward-compatible recognition for rows saved by the first fallback UI.
  const brand = String(value?.brand ?? "").trim();
  const name = String(value?.model ?? "").trim();
  if (brand && name) return { approved: true, brand, model: name, modelYear: value?.modelYear ?? null };
  const fallbackBrand = String(fallback?.brand ?? "").trim();
  const fallbackModel = String(fallback?.model ?? "").trim();
  if (fallbackBrand && fallbackModel) return { approved: false, brand: fallbackBrand, model: fallbackModel, modelYear: fallback?.modelYear ?? null };
  return null;
}

export function reconcileCurrentRowState(input: {
  importType: BulkImportType;
  normalizedPayload: Record<string, unknown>;
  pricingResult: Record<string, unknown> | null | undefined;
  existingIssues: BulkIssue[];
  canonicalModelYear?: number | null;
  manualResolution?: Record<string, unknown> | null;
}): { issues: BulkIssue[]; severity: BulkRowSeverity } {
  const manualModel = getManualModelResolution(input.manualResolution);
  const issues = input.existingIssues.filter((issue) => !DERIVED_CODES.has(issue.code) && !(manualModel && MODEL_RESOLUTION_CODES.has(issue.code)));
  const category = String(input.normalizedPayload.category ?? "").trim();
  if (!category) issues.push({ severity: "ERROR", code: "CATEGORY_REQUIRED", field: "category", message: "Selecciona una categoría antes de importar." });
  const model = String(input.normalizedPayload.model ?? "").trim();
  if (!input.canonicalModelYear && model && !getManualModelResolution(input.manualResolution)?.approved) {
    issues.push({ severity: "ERROR", code: "MANUAL_MODEL_APPROVAL_REQUIRED", field: "model", message: "El modelo no está vinculado al catálogo. Aprueba explícitamente el modelo manual antes de importar." });
  }
  if (input.importType === "FIRST_PARTY") {
    const pricing = getFirstPartyBulkPricingReadiness({ normalized_payload: input.normalizedPayload, pricing_result: input.pricingResult });
    if (!pricing.ready) issues.push({ severity: pricing.code === "MISSING_ACQUISITION_COST" ? "ERROR" : "WARNING", code: pricing.code, field: "price", message: pricing.message ?? pricing.label });
  }
  if (input.importType === "PARTNER") {
    const pricing = getPartnerBulkPricingReadiness({ normalized_payload: input.normalizedPayload, pricing_result: input.pricingResult });
    if (!pricing.ready) issues.push({ severity: "ERROR", code: pricing.code === "STALE_PRICING" ? "PARTNER_STALE_PRICING" : "PARTNER_PRICING_REVIEW_REQUIRED", field: "price", message: pricing.message ?? pricing.label });
    else if (pricing.warning) issues.push({ severity: "WARNING", code: "PARTNER_MARKET_WARNING", field: "price", message: pricing.message ?? pricing.label });
  }
  if (hasCanonicalModelYearMismatch({ canonicalModelYear: input.canonicalModelYear, normalizedModelYear: Number(input.normalizedPayload.modelYear) || null })) {
    issues.push({ severity: "ERROR", code: "MODEL_YEAR_MISMATCH", field: "modelYear", message: `El año recibido (${input.normalizedPayload.modelYear}) no coincide con la generación seleccionada (${input.canonicalModelYear}).` });
  }
  if (manualModel) issues.push({ severity: "INFO", code: "MANUAL_MODEL_APPROVED", field: "model", message: `Modelo manual aprobado: ${manualModel.brand} ${manualModel.model}.` });
  const severity = issues.some((issue) => issue.severity === "ERROR") ? "ERROR" : issues.some((issue) => issue.severity === "WARNING") ? "WARNING" : "READY";
  return { issues, severity };
}
