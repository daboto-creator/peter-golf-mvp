import { describe, expect, test } from "vitest";
import { getPartnerMarketplaceEconomicsCoherence, PARTNER_PRICING_CONFIGURATION_POLICY } from "./marketplace-pricing-coherence";

const coherentPricing = {
  approvedPriceMinor: 1_000_000,
  calculatedPublicPriceMinor: 1_000_000,
  estimatedPartnerNetMinor: 819_650,
  economics: {
    publicPriceMinor: 1_000_000,
    partnerNetMinor: 819_650,
    commissionMinor: 130_000,
    commissionVatMinor: 20_800,
    processingTotalMinor: 36_300,
    adminPercentageFeeMinor: 7_500,
    adminFixedFeeMinor: 3_900,
    estimatedBestRoundRevenueMinor: 123_250,
    meetsMinimumMarketplaceRevenue: true,
  },
};

describe("Partner Marketplace pricing snapshot coherence", () => {
  test("accepts one coherent reviewed snapshot", () => {
    expect(getPartnerMarketplaceEconomicsCoherence(coherentPricing)).toEqual({ coherent: true, code: "COHERENT" });
  });

  test("rejects a top-level public price mismatch", () => {
    expect(getPartnerMarketplaceEconomicsCoherence({ ...coherentPricing, approvedPriceMinor: 999_999 })).toMatchObject({ coherent: false, code: "PUBLIC_PRICE_MISMATCH" });
  });

  test("rejects a top-level Partner net mismatch", () => {
    expect(getPartnerMarketplaceEconomicsCoherence({ ...coherentPricing, estimatedPartnerNetMinor: 800_000 })).toMatchObject({ coherent: false, code: "PARTNER_NET_MISMATCH" });
  });

  test("rejects negative components and minimum-revenue failure", () => {
    expect(getPartnerMarketplaceEconomicsCoherence({ ...coherentPricing, economics: { ...coherentPricing.economics, commissionMinor: -1 } })).toMatchObject({ coherent: false, code: "NEGATIVE_ECONOMICS" });
    expect(getPartnerMarketplaceEconomicsCoherence({ ...coherentPricing, economics: { ...coherentPricing.economics, meetsMinimumMarketplaceRevenue: false } })).toMatchObject({ coherent: false, code: "MINIMUM_REVENUE_NOT_MET" });
  });

  test("documents reviewed snapshot authority across later config or tier changes", () => {
    expect(PARTNER_PRICING_CONFIGURATION_POLICY).toBe("REVIEWED_SNAPSHOT_AUTHORITATIVE");
  });
});
