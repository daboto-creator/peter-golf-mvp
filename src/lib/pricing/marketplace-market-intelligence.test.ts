import { describe, expect, it } from "vitest";

import { normalizeMarketplaceMarketResult } from "@/lib/pricing/marketplace-market-intelligence";
import type { MarketPriceResult } from "@/lib/pricing/market-price-provider";

function result(overrides: Partial<MarketPriceResult> = {}): MarketPriceResult {
  return {
    medianPriceMxn: 850_000,
    averagePriceMxn: 845_000,
    lowPriceMxn: 790_000,
    highPriceMxn: 900_000,
    sampleSize: 3,
    confidence: "high",
    source: "serpapi",
    sourceUrl: null,
    checkedAt: "2026-08-28T12:00:00.000Z",
    provider: "serpapi",
    searchQuery: "Titleist GT3 Driver México",
    excludedCount: 0,
    sources: [],
    ...overrides,
  };
}

describe("Marketplace market intelligence adapter", () => {
  it("maps existing provider output without adding financial truth", () => {
    const analysis = normalizeMarketplaceMarketResult(result());
    expect(analysis.status).toBe("COMPLETE");
    expect(analysis.confidence).toBe("HIGH");
    expect(analysis.recommendedPriceMinor).toBe(850_000);
    expect(Object.keys(analysis)).not.toContain("commissionMinor");
  });

  it("keeps provider failure explicit", () => {
    const analysis = normalizeMarketplaceMarketResult(
      result({
        provider: "unavailable",
        medianPriceMxn: null,
        averagePriceMxn: null,
        lowPriceMxn: null,
        highPriceMxn: null,
        sampleSize: 0,
        confidence: "unavailable",
      }),
    );
    expect(analysis.status).toBe("PROVIDER_UNAVAILABLE");
    expect(analysis.confidence).toBe("INSUFFICIENT");
  });
});
