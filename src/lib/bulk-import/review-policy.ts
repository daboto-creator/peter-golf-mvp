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

export type PartnerPricingReadiness = { ready: boolean; warning: boolean; label: string; code: "READY" | "PRICING_REVIEW_REQUIRED" | "STALE_PRICING"; message?: string };

export function getPartnerBulkPricingReadiness(row: ReviewApprovalRow): PartnerPricingReadiness {
  const pricing = row.pricing_result ?? {};
  const status = String(pricing.status ?? "");
  const amount = Number(pricing.approvedPriceMinor ?? pricing.proposedPriceMinor ?? pricing.calculatedPublicPriceMinor ?? 0);
  if (pricing.stale === true) return { ready: false, warning: false, code: "STALE_PRICING", label: "Precio desactualizado", message: "El precio de esta fila requiere una nueva revisión." };
  if (amount <= 0) return { ready: false, warning: false, code: "PRICING_REVIEW_REQUIRED", label: "Sin precio aprobado", message: "Define un precio público o un neto deseado." };
  const marketUnavailable = status === "INSUFFICIENT_DATA";
  const manuallyResolved = pricing.manualPriceApproved === true || pricing.humanReviewStatus === "APPROVED";
  if (marketUnavailable && manuallyResolved) return { ready: true, warning: true, code: "READY", label: "Precio listo · mercado limitado", message: "No encontramos suficiente referencia de mercado. El precio fue aprobado manualmente." };
  if (marketUnavailable || !["COMPETITIVE", "OVERPRICED", "UNDERPRICED"].includes(status)) return { ready: false, warning: false, code: "PRICING_REVIEW_REQUIRED", label: "Precio pendiente de aprobación", message: amount > 0 ? "El precio tiene valores calculados, pero la aprobación manual no quedó registrada." : "Revisa el precio público o el neto deseado antes de aprobar." };
  return { ready: true, warning: status !== "COMPETITIVE", code: "READY", label: "Precio listo", message: status === "COMPETITIVE" ? undefined : "El precio tiene una desviación frente al mercado." };
}

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

export function getDisplayedReviewedPriceMinor(pricingResult: Record<string, unknown> | null | undefined, normalizedPayload?: Record<string, unknown> | null) {
  const pricing = pricingResult ?? {};
  for (const value of [pricing.approvedPriceMinor, pricing.calculatedPublicPriceMinor, pricing.proposedPriceMinor, normalizedPayload?.askingPriceMinor]) {
    const amount = Number(value);
    if (Number.isSafeInteger(amount) && amount > 0) return amount;
  }
  return null;
}

export function shouldRecalculatePartnerPricing(input: {
  pricingSubmitted: boolean;
  priceChanged: boolean;
  desiredNetChanged: boolean;
  normalizedPayload: Record<string, unknown>;
  pricingResult: Record<string, unknown> | null | undefined;
}) {
  if (!input.pricingSubmitted) return false;
  const pricing = input.pricingResult ?? {};
  const readiness = getPartnerBulkPricingReadiness({ normalized_payload: input.normalizedPayload, pricing_result: pricing });
  const unresolved = !readiness.ready || pricing.manualPriceApproved !== true || pricing.humanReviewStatus !== "APPROVED" || pricing.stale === true || Number(pricing.approvedPriceMinor ?? pricing.calculatedPublicPriceMinor ?? pricing.proposedPriceMinor ?? 0) <= 0;
  return input.priceChanged || input.desiredNetChanged || unresolved;
}

export function shouldRecalculateFirstPartyPricing(input: {
  pricingSubmitted: boolean;
  normalizedPayload: Record<string, unknown>;
  pricingResult: Record<string, unknown> | null | undefined;
  costChanged: boolean;
}) {
  if (!input.pricingSubmitted || Number(input.normalizedPayload.askingPriceMinor ?? 0) <= 0 || Number(input.normalizedPayload.acquisitionCostMinor ?? 0) <= 0) return false;
  const pricing = input.pricingResult ?? {};
  const readiness = getFirstPartyBulkPricingReadiness({ normalized_payload: input.normalizedPayload, pricing_result: pricing });
  return input.costChanged || !readiness.ready || pricing.manualPriceApproved !== true || pricing.humanReviewStatus !== "APPROVED";
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
  if (options.importType === "PARTNER") {
    const pricingBlocked = included.filter((row) => !getPartnerBulkPricingReadiness(row).ready);
    if (pricingBlocked.length > 0) return { allowed: false as const, code: "PRICING_REVIEW_REQUIRED", pricingBlockedCount: pricingBlocked.length, message: `No puedes aprobar esta carga todavía. ${pricingBlocked.length} fila${pricingBlocked.length === 1 ? " requiere" : " requieren"} revisión de precio.` };
  }
  return { allowed: true as const, includedCount: included.length };
}
