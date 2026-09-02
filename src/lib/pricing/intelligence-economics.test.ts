import { describe, expect, it } from "vitest";
import {
  calculateFirstPartyDecision,
  convertUsdToMxn,
  evaluateMarketplaceDesiredPrice,
  summarizeResearchMarket,
} from "@/lib/pricing/intelligence-economics";
import type { ResearchResult } from "@/lib/pricing/intelligence-research";

function research(
  prices: Array<[number, "MEXICO" | "USA" | "BEST_ROUND_SALE"]>,
  confidence: ResearchResult["confidence"] = "HIGH",
): ResearchResult {
  return {
    status: "COMPLETE",
    evidenceLevel: "SUFFICIENT_MEDIUM",
    confidence,
    resolutionSource: "MEXICO",
    acceptedComparables: prices.map(([price, market], i) => ({
      title: `GT3 ${i}`,
      seller: "Golf",
      priceMinor: price,
      market,
      source: "test",
      observedAt: new Date().toISOString(),
      evidenceScore: 80,
      similarity: 90,
    })),
    excludedComparables: [],
    internalSalesUsed: prices.filter((p) => p[1] === "BEST_ROUND_SALE").length,
    cachedResearchUsed: false,
    mexicoQueriesExecuted: 1,
    usaQueriesExecuted: 0,
    fingerprint: "x",
    inputSnapshot: {} as ResearchResult["inputSnapshot"],
    engineVersion: "v1",
    expiresAt: new Date(Date.now() + 1_000).toISOString(),
    providerUnavailable: false,
    reasons: [],
  };
}

describe("Best Round economics decision", () => {
  it("uses weighted market range and deterministic integer prices", () => {
    const result = calculateFirstPartyDecision({
      research: research([
        [800000, "MEXICO"],
        [850000, "MEXICO"],
        [900000, "MEXICO"],
        [1200000, "USA"],
      ]),
      costs: {
        acquisitionCostMinor: 500000,
        paymentProcessingMinor: 10000,
        shippingMinor: 5000,
      },
    });
    expect(result.marketReferenceMinor).toBeGreaterThan(0);
    expect(Number.isSafeInteger(result.recommendedPriceMinor)).toBe(true);
    expect(result.minimumSafePriceMinor).toBeLessThanOrEqual(
      result.recommendedPriceMinor!,
    );
  });
  it("returns red when minimum economics exceed market", () => {
    const result = calculateFirstPartyDecision({
      research: research([
        [800000, "MEXICO"],
        [850000, "MEXICO"],
        [900000, "MEXICO"],
      ]),
      costs: { acquisitionCostMinor: 900000 },
    });
    expect(result.semaphore).toBe("RED");
  });
  it("covers healthy and tight commercial scenarios", () => {
    const market = research([
      [800000, "MEXICO"],
      [850000, "MEXICO"],
      [900000, "MEXICO"],
    ]);
    const healthy = calculateFirstPartyDecision({
      research: market,
      costs: { acquisitionCostMinor: 400000 },
    });
    const tight = calculateFirstPartyDecision({
      research: market,
      costs: { acquisitionCostMinor: 800000 },
    });
    expect(healthy.semaphore).toBe("GREEN");
    expect(tight.semaphore).toBe("YELLOW");
  });
  it("solves inverse acquisition cost without floating point", () => {
    const result = calculateFirstPartyDecision({
      research: research([
        [1000000, "MEXICO"],
        [1000000, "MEXICO"],
        [1000000, "MEXICO"],
      ]),
      costs: { acquisitionCostMinor: 400000, packagingMinor: 10000 },
    });
    expect(result.idealAcquisitionCostMinor).toBeGreaterThan(0);
    expect(result.maximumAcquisitionCostMinor).toBeGreaterThan(0);
  });
  it("keeps USA contribution visible and lowers confidence", () => {
    const result = calculateFirstPartyDecision({
      research: research([
        [1000000, "USA"],
        [1000000, "USA"],
        [1000000, "USA"],
      ]),
      costs: { acquisitionCostMinor: 400000 },
    });
    expect(result.usaContribution).toBe(3);
    expect(result.confidence).toBe("MEDIUM");
  });
  it("evaluates marketplace desired price without changing quote economics", () => {
    expect(
      evaluateMarketplaceDesiredPrice({
        desiredPriceMinor: 900000,
        recommendedPriceMinor: 850000,
        marketLowMinor: 800000,
        marketHighMinor: 880000,
        partnerNetMinor: 700000,
        minimumPartnerNetMinor: 650000,
      }),
    ).toBe("DESIRED_PRICE_HIGH");
    expect(
      evaluateMarketplaceDesiredPrice({
        desiredPriceMinor: 700000,
        recommendedPriceMinor: 850000,
        marketLowMinor: 800000,
        marketHighMinor: 880000,
        partnerNetMinor: 600000,
        minimumPartnerNetMinor: 650000,
      }),
    ).toBe("DESIRED_PRICE_ECONOMICALLY_INVALID");
  });
  it("converts USD using an explicit timestamped rate", () => {
    expect(
      convertUsdToMxn(10000, {
        rateNumerator: BigInt(1700),
        rateDenominator: BigInt(100),
        source: "test",
        observedAt: new Date().toISOString(),
      }),
    ).toBe(170000);
  });
  it("returns unknown market when research has no accepted evidence", () => {
    expect(summarizeResearchMarket(research([])).dispersion).toBe("UNKNOWN");
  });
});
