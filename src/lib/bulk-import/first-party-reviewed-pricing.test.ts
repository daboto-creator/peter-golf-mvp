import { describe, expect, test } from "vitest";
import type { PricingEngineResult } from "@/lib/pricing/pricing-types";
import { buildFailedFirstPartyReviewedPricing, buildSuccessfulFirstPartyReviewedPricing } from "./first-party-reviewed-pricing";

const successfulResult: PricingEngineResult = {
  totalDirectCost: 1_100_000,
  desiredContribution: 440_000,
  financialPrice: 1_597_822,
  minimumCompetitivePrice: null,
  marketLowerBound: null,
  marketUpperBound: null,
  automaticSuggestedPrice: 1_599_000,
  finalSalePrice: 1_650_000,
  estimatedPaymentFee: 77_500,
  expectedContribution: 472_500,
  returnOnCostBps: 4_295,
  marginOnSaleBps: 2_864,
  marketDeltaBps: null,
  status: "NO_MARKET_REFERENCE",
  health: "GREEN",
  override: true,
  manualPriceReason: null,
  warnings: [],
};

describe("First Party reviewed pricing persistence", () => {
  test("replaces a stale below-floor failure with a self-consistent successful result", () => {
    const previous = {
      belowFinancialFloor: true,
      approvedPriceMinor: null,
      manualPriceApproved: false,
      humanReviewStatus: null,
      stale: true,
      viability: "Sólo un administrador puede guardar por debajo del precio financiero.",
    };

    expect(buildSuccessfulFirstPartyReviewedPricing(previous, successfulResult)).toMatchObject({
      financialPriceMinor: 1_597_822,
      proposedPriceMinor: 1_650_000,
      approvedPriceMinor: 1_650_000,
      calculatedPublicPriceMinor: 1_650_000,
      belowFinancialFloor: false,
      manualPriceApproved: true,
      humanReviewStatus: "APPROVED",
      stale: false,
      viability: "Precio aprobado manualmente",
    });
  });

  test("a later below-floor rejection clears the prior approval", () => {
    const approved = buildSuccessfulFirstPartyReviewedPricing({}, successfulResult);
    const rejected = buildFailedFirstPartyReviewedPricing(approved, {
      salePriceMinor: 1_500_000,
      error: "Sólo un administrador puede guardar por debajo del precio financiero.",
    });

    expect(rejected).toMatchObject({
      financialPriceMinor: 1_597_822,
      proposedPriceMinor: 1_500_000,
      approvedPriceMinor: null,
      calculatedPublicPriceMinor: null,
      belowFinancialFloor: true,
      manualPriceApproved: false,
      manualOverride: false,
      humanReviewStatus: null,
    });
  });
});
