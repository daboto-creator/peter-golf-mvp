import type { BulkIssue, BulkImportType, BulkRowSeverity } from "./types";
import { getFirstPartyBulkPricingReadiness, hasCanonicalModelYearMismatch } from "./review-policy";

const DERIVED_CODES = new Set([
  "INSUFFICIENT_DATA", "PRICING_REVIEW_REQUIRED", "MISSING_APPROVED_PRICE", "STALE_PRICING",
  "MISSING_ACQUISITION_COST", "AMBIGUOUS_CATEGORY", "UNKNOWN_CATEGORY", "CATEGORY_REQUIRED", "MODEL_YEAR_MISMATCH",
]);

export function reconcileCurrentRowState(input: {
  importType: BulkImportType;
  normalizedPayload: Record<string, unknown>;
  pricingResult: Record<string, unknown> | null | undefined;
  existingIssues: BulkIssue[];
  canonicalModelYear?: number | null;
}): { issues: BulkIssue[]; severity: BulkRowSeverity } {
  const issues = input.existingIssues.filter((issue) => !DERIVED_CODES.has(issue.code));
  const category = String(input.normalizedPayload.category ?? "").trim();
  if (!category) issues.push({ severity: "ERROR", code: "CATEGORY_REQUIRED", field: "category", message: "Selecciona una categoría antes de importar." });
  if (input.importType === "FIRST_PARTY") {
    const pricing = getFirstPartyBulkPricingReadiness({ normalized_payload: input.normalizedPayload, pricing_result: input.pricingResult });
    if (!pricing.ready) issues.push({ severity: pricing.code === "MISSING_ACQUISITION_COST" ? "ERROR" : "WARNING", code: pricing.code, field: "price", message: pricing.message ?? pricing.label });
  }
  if (hasCanonicalModelYearMismatch({ canonicalModelYear: input.canonicalModelYear, normalizedModelYear: Number(input.normalizedPayload.modelYear) || null })) {
    issues.push({ severity: "ERROR", code: "MODEL_YEAR_MISMATCH", field: "modelYear", message: `El año recibido (${input.normalizedPayload.modelYear}) no coincide con la generación seleccionada (${input.canonicalModelYear}).` });
  }
  const severity = issues.some((issue) => issue.severity === "ERROR") ? "ERROR" : issues.some((issue) => issue.severity === "WARNING") ? "WARNING" : "READY";
  return { issues, severity };
}
