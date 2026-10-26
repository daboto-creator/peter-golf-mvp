import type { PricingEngineResult } from "@/lib/pricing/pricing-types";

export function buildSuccessfulFirstPartyReviewedPricing(
  previous: Record<string, unknown> | null | undefined,
  result: PricingEngineResult,
) {
  return {
    ...(previous ?? {}),
    status: "INSUFFICIENT_DATA",
    marketStatus: "INSUFFICIENT_DATA",
    financialPriceMinor: result.financialPrice,
    automaticSuggestedPriceMinor: result.automaticSuggestedPrice,
    proposedPriceMinor: result.finalSalePrice,
    approvedPriceMinor: result.finalSalePrice,
    calculatedPublicPriceMinor: result.finalSalePrice,
    expectedContributionMinor: result.expectedContribution,
    returnOnCostBps: result.returnOnCostBps,
    marginOnSaleBps: result.marginOnSaleBps,
    manualPriceApproved: true,
    manualOverride: result.override,
    manualPriceReason: result.manualPriceReason,
    stale: false,
    humanReviewStatus: "APPROVED",
    belowFinancialFloor: false,
    viability: "Precio aprobado manualmente",
  };
}

export function buildFailedFirstPartyReviewedPricing(
  previous: Record<string, unknown> | null | undefined,
  input: { salePriceMinor: number; error: string },
) {
  return {
    ...(previous ?? {}),
    status: "INSUFFICIENT_DATA",
    marketStatus: "INSUFFICIENT_DATA",
    financialPriceMinor: Number(previous?.financialPriceMinor ?? 0),
    proposedPriceMinor: input.salePriceMinor,
    approvedPriceMinor: null,
    calculatedPublicPriceMinor: null,
    manualPriceApproved: false,
    manualOverride: false,
    manualPriceReason: null,
    stale: false,
    humanReviewStatus: null,
    belowFinancialFloor:
      input.error.includes("debajo") || input.error.includes("administrador"),
    viability: input.error,
  };
}
