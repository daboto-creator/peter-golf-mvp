import { describe, expect, it } from "vitest";

import type { MarketPriceInput } from "@/lib/pricing/market-price-provider";
import type { RawMarketComparable } from "@/lib/pricing/market-price-matching";
import {
  averageMinorUnits,
  buildMarketPriceResult,
  medianMinorUnits,
} from "@/lib/pricing/market-price-statistics";

const product: MarketPriceInput = {
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
  shaftBrand: "Mitsubishi",
  shaftModel: "Tensei 1K Blue",
  shaftFlex: "regular",
  condition: "new",
  conditionGrade: null,
  conditionScore: null,
  targetPlayer: "men",
  market: "MX",
};

function comparable(
  priceMxn: number,
  overrides: Partial<RawMarketComparable> = {},
): RawMarketComparable {
  return {
    merchant: `Golf Shop ${priceMxn}`,
    productName: "Titleist GT3 Driver 2025 9 Right Regular Tensei 1K Blue",
    priceMxn,
    originalCurrency: "MXN",
    originalPrice: String(priceMxn / 100),
    url: `https://merchant.example/${priceMxn}`,
    identifier: String(priceMxn),
    availability: "in_stock",
    condition: "new",
    marketScope: "mexico",
    ...overrides,
  };
}

function result(comparables: RawMarketComparable[]) {
  return buildMarketPriceResult({
    product,
    comparables,
    provider: "serpapi",
    searchQuery: "Titleist GT3 Driver México",
    checkedAt: "2026-08-18T21:00:00.000Z",
  });
}

describe("market comparable processing", () => {
  it("calculates integer-safe median and average", () => {
    expect(medianMinorUnits([1_199_900, 1_249_900, 1_325_000])).toBe(1_249_900);
    expect(medianMinorUnits([1_199_900, 1_249_900])).toBe(1_224_900);
    expect(averageMinorUnits([1_199_900, 1_249_900, 1_325_000])).toBe(
      1_258_267,
    );
  });

  it("returns high confidence from multiple exact Mexican comparables", () => {
    const market = result([
      comparable(1_199_900),
      comparable(1_249_900),
      comparable(1_325_000),
    ]);
    expect(market.confidence).toBe("high");
    expect(market.medianPriceMxn).toBe(1_249_900);
    expect(market.averagePriceMxn).toBe(1_258_267);
    expect(market.sampleSize).toBe(3);
  });

  it("excludes a different model and never mixes used into new", () => {
    const market = result([
      comparable(1_199_900),
      comparable(900_000, {
        productName: "Titleist GT2 Driver 9 Right Regular",
      }),
      comparable(850_000, { condition: "used" }),
    ]);
    expect(market.sampleSize).toBe(1);
    expect(market.excludedCount).toBe(2);
    expect(market.confidence).toBe("low");
  });

  it("removes a statistical outlier after semantic matching", () => {
    const market = result([
      comparable(1_190_000),
      comparable(1_200_000),
      comparable(1_210_000),
      comparable(1_220_000),
      comparable(9_900_000),
    ]);
    expect(market.highPriceMxn).toBe(1_220_000);
    expect(market.sampleSize).toBe(4);
    expect(market.excludedCount).toBe(1);
  });

  it("returns medium confidence from two reasonable matches", () => {
    const market = result([
      comparable(1_199_900, {
        productName: "Titleist GT3 Driver 9 Right Regular",
      }),
      comparable(1_249_900, {
        productName: "Titleist GT3 Driver 10 Right Regular",
      }),
    ]);
    expect(market.confidence).toBe("medium");
  });

  it("accepts an SM10 listing that omits the Vokey family name", () => {
    const market = buildMarketPriceResult({
      product: {
        ...product,
        model: "Vokey SM10",
        clubType: "wedge",
        loftDegrees: 56,
        shaftFlex: null,
      },
      comparables: [
        comparable(450_000, {
          productName: "Titleist SM10 Jet Black Wedge 56.08 M",
        }),
      ],
      provider: "serpapi",
      searchQuery: "Titleist Vokey SM10 Wedge México",
      checkedAt: "2026-08-18T21:00:00.000Z",
    });

    expect(market.sampleSize).toBe(1);
    expect(market.medianPriceMxn).toBe(450_000);
  });

  it("matches compact model spelling but excludes heads and distinct variants", () => {
    const stealthProduct = {
      ...product,
      brand: "TaylorMade",
      model: "Stealth 2",
      condition: "used" as const,
    };
    const market = buildMarketPriceResult({
      product: stealthProduct,
      comparables: [
        comparable(650_000, {
          productName: "TaylorMade Stealth2 Driver 10.5 Regular Right",
          condition: "used",
        }),
        comparable(500_000, {
          productName: "TaylorMade Stealth 2 Driver Solo Cabeza Con Cubierta",
          condition: "used",
        }),
        comparable(600_000, {
          productName: "TaylorMade Stealth 2 Plus Driver Regular",
          condition: "used",
        }),
        comparable(610_000, {
          productName: "TaylorMade Stealth 2 HD Driver Regular",
          condition: "used",
        }),
      ],
      provider: "serpapi",
      searchQuery: "TaylorMade Stealth 2 Driver seminuevo México",
      checkedAt: "2026-08-18T21:00:00.000Z",
    });

    expect(market.sampleSize).toBe(1);
    expect(market.medianPriceMxn).toBe(650_000);
    expect(market.excludedCount).toBe(3);
  });

  it("keeps Qi35 base separate from Max, Max Lite and LS", () => {
    const qi35 = {
      ...product,
      brand: "TaylorMade",
      model: "Qi35",
    };
    const market = buildMarketPriceResult({
      product: qi35,
      comparables: [
        comparable(800_000, {
          productName: "TaylorMade Qi35 Driver Right",
        }),
        comparable(810_000, {
          productName: "TaylorMade Qi35 Max Driver Right",
        }),
        comparable(820_000, {
          productName: "TaylorMade Qi35 Max Lite Driver Right",
        }),
        comparable(830_000, {
          productName: "TaylorMade Qi35 LS Driver Right",
        }),
      ],
      provider: "serpapi",
      searchQuery: "TaylorMade Qi35 Driver México",
      checkedAt: "2026-08-18T21:00:00.000Z",
    });

    expect(market.sampleSize).toBe(1);
    expect(market.medianPriceMxn).toBe(800_000);
    expect(market.excludedCount).toBe(3);
  });
});
