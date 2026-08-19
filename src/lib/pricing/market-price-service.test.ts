import { describe, expect, it } from "vitest";

import type {
  MarketPriceInput,
  MarketPriceProvider,
} from "@/lib/pricing/market-price-provider";
import { researchMarketPriceSafely } from "@/lib/pricing/market-price-resilience";

const input: MarketPriceInput = {
  brand: "Titleist",
  model: "GT3",
  modelYear: 2025,
  productFamily: "club",
  clubType: "driver",
  clubNumber: null,
  setType: null,
  bagType: null,
  loftDegrees: 9,
  handedness: "right",
  shaftMaterial: "graphite",
  shaftBrand: null,
  shaftModel: null,
  shaftFlex: "regular",
  condition: "new",
  conditionGrade: null,
  conditionScore: null,
  targetPlayer: null,
  market: "MX",
};

describe("market research resilience", () => {
  it.each(["timeout", "provider error"])("falls back on %s", async () => {
    const provider: MarketPriceProvider = {
      getMarketPrice: async () => {
        throw new Error("external failure");
      },
    };
    const response = await researchMarketPriceSafely(input, {
      provider,
      failureProviderName: "test-provider",
    });
    expect(response.failed).toBe(true);
    expect(response.result.confidence).toBe("unavailable");
    expect(response.result.medianPriceMxn).toBeNull();
  });
});
