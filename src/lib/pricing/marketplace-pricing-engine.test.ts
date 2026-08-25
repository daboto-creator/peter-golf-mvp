import { describe, expect, it } from "vitest";

import {
  calculateMarketplaceEconomics,
  classifyMarketplaceViability,
  resolveMarketplacePrice,
  solvePublicPriceForPartnerNet,
} from "@/lib/pricing/marketplace-pricing-engine";
import type {
  MarketplaceEconomicsConfig,
  MarketplaceTier,
} from "@/lib/pricing/marketplace-pricing-types";

const commissions: Record<MarketplaceTier, number> = {
  BOGEY: 1500,
  PAR: 1400,
  BIRDIE: 1300,
  ALBATROSS: 1200,
  HOLE_IN_ONE: 1100,
};

function config(commissionBps = 1300): MarketplaceEconomicsConfig {
  return {
    commissionBps,
    commissionVatBps: 1600,
    paymentProcessingBps: 360,
    paymentProcessingFixedMinor: 300,
    partnerProcessingShareBps: 5000,
    adminFeeBps: 75,
    adminFixedFeeMinor: 3900,
    minimumMarketplaceRevenueMinor: null,
  };
}

describe("Marketplace deterministic economics", () => {
  it.each(Object.entries(commissions))(
    "uses the configured %s commission snapshot",
    (tier, commissionBps) => {
      const result = calculateMarketplaceEconomics(
        1_000_000,
        config(commissionBps),
      );
      expect(result.commissionMinor).toBe(commissionBps * 100);
      expect(result.commissionVatMinor).toBe(commissionBps * 16);
      expect(result.publicPriceMinor).toBe(1_000_000);
      expect(tier).toBeTruthy();
    },
  );

  it("splits processing, charges both admin components and avoids double counting", () => {
    const result = calculateMarketplaceEconomics(1_000_000, config());
    expect(result.processingTotalMinor).toBe(36_300);
    expect(result.partnerProcessingShareMinor).toBe(18_150);
    expect(result.bestRoundProcessingShareMinor).toBe(18_150);
    expect(result.adminPercentageFeeMinor).toBe(7_500);
    expect(result.adminFixedFeeMinor).toBe(3_900);
    expect(result.partnerNetMinor).toBe(819_650);
    expect(result.grossBestRoundRevenueMinor).toBe(141_400);
    expect(result.taxPassThroughMinor).toBe(20_800);
    expect(result.estimatedBestRoundRevenueMinor).toBe(123_250);
  });

  it("rejects zero and impossible economics", () => {
    expect(() => calculateMarketplaceEconomics(0, config())).toThrow(
      /mayor que cero/,
    );
    expect(() =>
      calculateMarketplaceEconomics(100, {
        ...config(9999),
        commissionVatBps: 9999,
        adminFeeBps: 9999,
      }),
    ).toThrow(/exceden/);
  });

  it.each(Object.entries(commissions))(
    "solves desired net forward for %s within one cent",
    (_tier, commissionBps) => {
      const desired = 700_000;
      const solved = solvePublicPriceForPartnerNet(
        desired,
        config(commissionBps),
      );
      expect(solved.partnerNetMinor).toBeGreaterThanOrEqual(desired);
      const previous = calculateMarketplaceEconomics(
        solved.publicPriceMinor - 1,
        config(commissionBps),
      );
      expect(previous.partnerNetMinor).toBeLessThan(desired);
    },
  );

  it("reports incompatible desired price and desired net without changing either", () => {
    const resolved = resolveMarketplacePrice({
      inputMode: "PUBLIC_PRICE_PRIORITY",
      desiredPublicPriceMinor: 1_000_000,
      desiredPartnerNetMinor: 900_000,
      config: config(),
    });
    expect(resolved.calculatedPublicPriceMinor).toBe(1_000_000);
    expect(resolved.desiredPartnerNetMinor).toBe(900_000);
    expect(resolved.desiredNetDeltaMinor).toBe(-80_350);
  });
});

describe("Marketplace market viability", () => {
  it.each([
    [900_000, "COMPETITIVE"],
    [1_100_000, "COMPETITIVE"],
    [899_999, "UNDERPRICED"],
    [1_100_001, "OVERPRICED"],
  ] as const)("classifies %i against the ±10%% rule", (price, expected) => {
    expect(
      classifyMarketplaceViability({
        publicPriceMinor: price,
        recommendedPriceMinor: 1_000_000,
        toleranceBps: 1000,
      }).viability,
    ).toBe(expected);
  });

  it("does not invent a market reference", () => {
    expect(
      classifyMarketplaceViability({
        publicPriceMinor: 1_000_000,
        recommendedPriceMinor: null,
        toleranceBps: 1000,
      }).viability,
    ).toBe("INSUFFICIENT_DATA");
  });
});
