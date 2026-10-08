export type ReviewApprovalRow = {
  excluded?: boolean;
  severity?: string;
  canonicalModelYear?: number | null;
  normalizedModelYear?: number | null;
  pricing_result?: Record<string, unknown> | null;
  normalized_payload?: Record<string, unknown> | null;
};

export function isFirstPartyBulkRowPricingReady(row: ReviewApprovalRow) {
  const pricing = row.pricing_result ?? {};
  const proposed = Number(pricing.proposedPriceMinor ?? pricing.approvedPriceMinor ?? 0);
  const acquisition = Number(row.normalized_payload?.acquisitionCostMinor ?? 0);
  const status = String(pricing.status ?? "");
  const manuallyResolved = pricing.manualPriceApproved === true || pricing.manualOverride === true;
  return proposed > 0 && acquisition > 0 && (manuallyResolved || ["COMPETITIVE", "OVERPRICED", "UNDERPRICED"].includes(status)) && pricing.stale !== true;
}

export function hasCanonicalModelYearMismatch(row: ReviewApprovalRow) {
  return row.canonicalModelYear != null && row.normalizedModelYear != null && row.canonicalModelYear !== row.normalizedModelYear;
}

export function canApproveBulkImport(rows: ReviewApprovalRow[], options: { importType?: "FIRST_PARTY" | "PARTNER" } = {}) {
  const included = rows.filter((row) => !row.excluded);
  if (included.length === 0) return { allowed: false as const, code: "NO_INCLUDED_ROWS", message: "Debes conservar al menos una fila para aprobar la carga." };
  if (included.some((row) => row.severity === "ERROR")) return { allowed: false as const, code: "INCLUDED_ERRORS", message: "No puedes aprobar la carga mientras existan filas incluidas con errores." };
  if (options.importType === "FIRST_PARTY") {
    const pricingBlocked = included.filter((row) => !isFirstPartyBulkRowPricingReady(row));
    if (pricingBlocked.length > 0) return { allowed: false as const, code: "PRICING_REVIEW_REQUIRED", pricingBlockedCount: pricingBlocked.length, message: `No puedes aprobar esta carga todavía. ${pricingBlocked.length} fila${pricingBlocked.length === 1 ? " requiere" : " requieren"} revisión de precio.` };
    if (included.some(hasCanonicalModelYearMismatch)) return { allowed: false as const, code: "MODEL_YEAR_MISMATCH", message: "El año recibido no coincide con la generación seleccionada. Selecciona otra generación o usa el modelo manual." };
  }
  return { allowed: true as const, includedCount: included.length };
}
