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

  it.each(Object.entries(commissions))(
    "conserves every Partner cent and processing split for %s",
    (_tier, commissionBps) => {
      for (const publicPriceMinor of [10_000, 99_999, 854_176, 1_000_001]) {
        const result = calculateMarketplaceEconomics(
          publicPriceMinor,
          config(commissionBps),
        );
        expect(
          result.partnerProcessingShareMinor +
            result.bestRoundProcessingShareMinor,
        ).toBe(result.processingTotalMinor);
        expect(
          result.partnerNetMinor +
            result.commissionMinor +
            result.commissionVatMinor +
            result.partnerProcessingShareMinor +
            result.adminPercentageFeeMinor +
            result.adminFixedFeeMinor +
            result.otherConfiguredFeesMinor,
        ).toBe(publicPriceMinor);
      }
    },
  );

  it("assigns an odd processing cent once using the deterministic waterfall", () => {
    const result = calculateMarketplaceEconomics(10_001, {
      ...config(),
      paymentProcessingBps: 1,
      paymentProcessingFixedMinor: 0,
      partnerProcessingShareBps: 5000,
    });
    expect(result.processingTotalMinor).toBe(2);
    expect(
      result.partnerProcessingShareMinor + result.bestRoundProcessingShareMinor,
    ).toBe(2);
  });

  it("rounds commission VAT within the cumulative monetary waterfall", () => {
    const result = calculateMarketplaceEconomics(854_177, config());
    expect(result.commissionMinor + result.commissionVatMinor).toBe(
      Number(
        (BigInt(854_177) * BigInt(1300) * BigInt(11_600) + BigInt(99_999_999)) /
          BigInt(100_000_000),
      ),
    );
    expect(result.taxPassThroughMinor).toBe(result.commissionVatMinor);
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
    ).toThrow(/cargos variables/);
  });

  it.each(Object.entries(commissions))(
    "is cent-by-cent monotonic across rounding boundaries for %s",
    (_tier, commissionBps) => {
      const ranges = [
        [6_000, 16_000],
        [95_000, 105_000],
        [495_000, 505_000],
        [849_000, 859_000],
        [995_000, 1_005_000],
        [2_995_000, 3_005_000],
      ] as const;
      for (const [start, end] of ranges) {
        let previousNet: number | null = null;
        for (let price = start; price <= end; price += 1) {
          const current = calculateMarketplaceEconomics(
            price,
            config(commissionBps),
          );
          if (previousNet !== null) {
            expect(current.partnerNetMinor).toBeGreaterThanOrEqual(previousNet);
          }
          previousNet = current.partnerNetMinor;
        }
      }
    },
  );

  it.each(Object.entries(commissions))(
    "solves the exact minimum public price for %s",
    (_tier, commissionBps) => {
      for (const desired of [
        100, 10_001, 99_999, 699_533, 700_000, 2_500_001,
      ]) {
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
      }
    },
  );

  it("keeps the reported Birdie boundary monotonic and solves 699,533 exactly", () => {
    const prices = [854_176, 854_177, 854_178];
    const nets = prices.map(
      (price) => calculateMarketplaceEconomics(price, config()).partnerNetMinor,
    );
    expect(nets[1]).toBeGreaterThanOrEqual(nets[0]);
    expect(nets[2]).toBeGreaterThanOrEqual(nets[1]);

    const solved = solvePublicPriceForPartnerNet(699_533, config());
    expect(solved.publicPriceMinor).toBe(854_174);
    expect(solved.partnerNetMinor).toBe(699_533);
    expect(
      calculateMarketplaceEconomics(solved.publicPriceMinor - 1, config())
        .partnerNetMinor,
    ).toBeLessThan(699_533);
  });

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
