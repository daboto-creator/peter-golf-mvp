export type ReviewApprovalRow = {
  excluded?: boolean;
  severity?: string;
  canonicalModelYear?: number | null;
  normalizedModelYear?: number | null;
  pricing_result?: Record<string, unknown> | null;
  normalized_payload?: Record<string, unknown> | null;
};

export type FirstPartyPricingReadiness = {
  ready: boolean;
  code: "READY" | "PRICING_REVIEW_REQUIRED" | "MISSING_ACQUISITION_COST" | "MISSING_APPROVED_PRICE" | "STALE_PRICING";
  label: string;
  message?: string;
};

export function getFirstPartyBulkPricingReadiness(row: ReviewApprovalRow): FirstPartyPricingReadiness {
  const pricing = row.pricing_result ?? {};
  const proposed = Number(pricing.proposedPriceMinor ?? pricing.approvedPriceMinor ?? 0);
  const acquisition = Number(row.normalized_payload?.acquisitionCostMinor ?? 0);
  const status = String(pricing.status ?? "");
  const manuallyResolved = pricing.manualPriceApproved === true || pricing.manualOverride === true;
  if (acquisition <= 0) return { ready: false, code: "MISSING_ACQUISITION_COST", label: "Requiere costo de adquisición", message: "First Party requiere un costo de adquisición válido." };
  if (pricing.stale === true) return { ready: false, code: "STALE_PRICING", label: "Precio desactualizado", message: "El precio cambió y debe validarse nuevamente." };
  if (proposed <= 0) return { ready: false, code: "MISSING_APPROVED_PRICE", label: "Sin precio aprobado", message: "Define y aprueba un precio antes de importar." };
  if (!manuallyResolved && !["COMPETITIVE", "OVERPRICED", "UNDERPRICED"].includes(status)) return { ready: false, code: "PRICING_REVIEW_REQUIRED", label: "Requiere revisión de precio", message: "No hay suficiente información de mercado para validar este precio. Define o aprueba un precio antes de importar." };
  return { ready: true, code: "READY", label: "Precio listo" };
}

export function isFirstPartyBulkRowPricingReady(row: ReviewApprovalRow) {
  return getFirstPartyBulkPricingReadiness(row).ready;
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
