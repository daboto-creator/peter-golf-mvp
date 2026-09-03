import { describe, expect, it, vi } from "vitest";

import {
  buildResearchFingerprint,
  classifyComparableProductKind,
  classifyComparableCertainty,
  AiComparableAmbiguityResolver,
  COMPARABLE_CLASSIFIER_VERSION,
  evaluateEvidenceSufficiency,
  researchBestRoundIntelligence,
  scoreResearchSimilarity,
  type ResearchProductInput,
} from "@/lib/pricing/intelligence-research";
import type { MarketPriceProvider } from "@/lib/pricing/market-price-provider";

const input: ResearchProductInput = {
  brand: "Titleist",
  model: "GT3",
  modelYear: 2024,
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
  condition: "used",
  conditionGrade: "A",
  conditionScore: 9,
  targetPlayer: null,
  market: "MX",
};

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    title: "Titleist GT3 Driver 9 right regular",
    seller: "Best Round",
    priceMinor: 100000,
    market: "BEST_ROUND_SALE" as const,
    source: "internal",
    observedAt: new Date().toISOString(),
    condition: "used" as const,
    similarity: 95,
    ...overrides,
  };
}

describe("Best Round intelligence research", () => {
  it("builds stable fingerprints and category-aware scores", () => {
    expect(buildResearchFingerprint(input)).toHaveLength(64);
    expect(
      scoreResearchSimilarity(input, candidate()).score,
    ).toBeGreaterThanOrEqual(75);
    expect(
      scoreResearchSimilarity(
        input,
        candidate({ product: { handedness: "left" } }),
      ).hardMismatch,
    ).toBe(false);
  });

  it("resolves with three strong internal sales without calling provider", async () => {
    const provider = {
      getMarketPrice: vi.fn(),
    } as unknown as MarketPriceProvider;
    const result = await researchBestRoundIntelligence(input, {
      provider,
      internalSales: [
        candidate(),
        candidate({ id: "2", priceMinor: 101000 }),
        candidate({ id: "3", priceMinor: 99000 }),
      ],
    });
    expect(result.evidenceLevel).toBe("SUFFICIENT_HIGH");
    expect(result.internalSalesUsed).toBe(3);
    expect(result.comparableClassifierVersion).toBe(
      COMPARABLE_CLASSIFIER_VERSION,
    );
    expect(provider.getMarketPrice).not.toHaveBeenCalled();
  });

  it("uses bounded Mexico then USA fallback and deduplicates", async () => {
    const provider: MarketPriceProvider = {
      getMarketPrice: vi.fn(async (_input, options) => ({
        medianPriceMxn: null,
        averagePriceMxn: null,
        lowPriceMxn: null,
        highPriceMxn: null,
        sampleSize: 0,
        confidence: "unavailable" as const,
        source: null,
        sourceUrl: null,
        checkedAt: new Date().toISOString(),
        provider: options?.market === "US" ? "usa" : "mx",
        searchQuery: options?.query ?? null,
        sources: [],
        excludedCount: 0,
      })),
    };
    const result = await researchBestRoundIntelligence(input, {
      provider,
      maxMexicoQueries: 2,
      maxUsaQueries: 1,
      forceRefresh: true,
    });
    expect(result.mexicoQueriesExecuted).toBe(2);
    expect(result.usaQueriesExecuted).toBe(1);
    expect(result.acceptedComparables).toHaveLength(0);
  });

  it("applies approved internal thresholds", () => {
    expect(
      evaluateEvidenceSufficiency([
        candidate(),
        candidate({ id: "2" }),
        candidate({ id: "3" }),
      ]).level,
    ).toBe("SUFFICIENT_HIGH");
  });

  it("excludes incompatible components, promotions, auctions and stockouts", async () => {
    const provider = {
      getMarketPrice: vi.fn(),
    } as unknown as MarketPriceProvider;
    const result = await researchBestRoundIntelligence(input, {
      provider,
      internalSales: [
        candidate({ id: "head", title: "Titleist GT3 Driver Head Only" }),
        candidate({ id: "shaft", title: "Titleist GT3 shaft only" }),
        candidate({
          id: "promo",
          title: "Titleist GT3 Driver coupon required",
        }),
        candidate({ id: "auction", title: "Titleist GT3 Driver auction" }),
        candidate({ id: "stock", availability: "out_of_stock" }),
      ],
    });
    expect(result.acceptedComparables).toHaveLength(0);
    expect(result.excludedComparables.map((item) => item.exclusion)).toEqual(
      expect.arrayContaining([
        "HEAD_ONLY",
        "SHAFT_ONLY",
        "COUPON_PRICE",
        "AUCTION_UNRESOLVED",
        "OUT_OF_STOCK",
      ]),
    );
  });

  it("classifies real-product titles separately from accessory noise", () => {
    const full = [
      "Driver Titleist Golf Club GT3 9° S-flex Tensei 1K Azul 55",
      "Driver Titleist GT3 Grafito Tensei 1K Stiff",
    ];
    const accessories = [
      "Golf Weight Titleist GT3 Driver 2 G, Posventa, Alta Calidad",
      "Juego de pesas deslizantes para golf, compatible con Titleist GT3 Driver Club",
      "Peso de Golf Para Titleist GT3 Driver",
      "Peso Compatible Con Titleist GT3 Driver GT3 Fairway Wood",
      "Nuevo Titleist Serie GT3 Driver Sure Fit Peso Pista 14g",
      "Pesa Deslizante De Golf Para Titleist GT3 Driver, 12 G",
    ];
    for (const title of full)
      expect(
        classifyComparableProductKind(input, candidate({ title })).kind,
      ).toBe("FULL_PRODUCT");
    for (const title of accessories) {
      const result = scoreResearchSimilarity(input, candidate({ title }));
      expect(result.hardMismatch).toBe(true);
      expect(result.reasons).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/WEIGHT|ACCESSORY|REPLACEMENT/),
        ]),
      );
    }
    expect(
      scoreResearchSimilarity(
        input,
        candidate({
          title: "Driver Titleist Golf GT3 Zurdo 10° S-flex Tensei 1K Azul 55",
        }),
      ).reasons,
    ).toContain("HAND_MISMATCH");
    expect(
      classifyComparableProductKind(
        input,
        candidate({ title: "Titleist GT3 Driver with Tensei shaft" }),
      ).kind,
    ).toBe("FULL_PRODUCT");
  });

  it("keeps condition and explicit handedness hard requirements", async () => {
    const provider = {
      getMarketPrice: vi.fn(),
    } as unknown as MarketPriceProvider;
    const result = await researchBestRoundIntelligence(
      { ...input, condition: "new" },
      {
        provider,
        internalSales: [
          candidate({
            id: "new",
            condition: "new",
            title: "New Titleist GT3 Driver 9 RH Regular",
          }),
          candidate({
            id: "used",
            condition: "used",
            title: "Used Titleist GT3 Driver 9 RH Regular",
          }),
          candidate({
            id: "left",
            condition: "new",
            title: "Titleist GT3 Driver | Left-Handed 9° Loft Regular Flex",
          }),
        ],
      },
    );
    expect(result.acceptedComparables.map((item) => item.id)).toContain("new");
    expect(result.excludedComparables.map((item) => item.exclusion)).toEqual(
      expect.arrayContaining(["USED_FOR_NEW_TARGET"]),
    );
  });

  it("uses certainty to reject ambiguous marketing titles without rejecting a confirmed generic listing", () => {
    const validTitles = [
      "Driver Titleist GT3 Grafito Tensei 1K Stiff",
      "Titleist GT3 Driver | Left-Handed 9° Loft Regular Flex",
      "Titleist GT3 Driver",
    ];
    for (const title of validTitles) {
      const value = classifyComparableCertainty(
        { ...input, condition: "new" },
        candidate({
          title,
          condition: "new",
          sourceType: "SPECIALIST_RETAILER",
        }),
      );
      expect(value.certainty).toBe("STRONG");
    }
    for (const title of [
      "Titleist GT3 Driver 9° Tour Inspired Low Spin Adjustable Performance",
      "Titleist GT3 Golf Driver",
    ]) {
      const value = classifyComparableCertainty(
        { ...input, condition: "new" },
        candidate({ title, condition: "new", seller: "Unknown marketplace" }),
      );
      expect(value.certainty).toBe("AMBIGUOUS");
    }
  });

  it("allows AI to resolve only the ambiguity band and falls back safely", async () => {
    const provider = {
      getMarketPrice: vi.fn(),
    } as unknown as MarketPriceProvider;
    const resolver = new AiComparableAmbiguityResolver(async () => ({
      decision: "SAME_PRODUCT" as const,
      confidence: "MEDIUM" as const,
      reasons: ["provider metadata confirms complete club"],
    }));
    const result = await researchBestRoundIntelligence(
      { ...input, condition: "new" },
      {
        provider,
        ambiguityResolver: resolver,
        internalSales: [
          candidate({
            id: "ambiguous",
            title:
              "Titleist GT3 Driver 9° Tour Inspired Low Spin Adjustable Performance",
            condition: "new",
          }),
        ],
      },
    );
    expect(result.acceptedComparables.map((item) => item.id)).toContain(
      "ambiguous",
    );
    expect(result.acceptedComparables[0]?.certainty).toBe("STRONG");
  });

  it("penalizes loft and flex changes while treating putter flex as irrelevant", () => {
    const loft = scoreResearchSimilarity(
      input,
      candidate({ product: { loftDegrees: 10.5 } }),
    );
    const flex = scoreResearchSimilarity(
      input,
      candidate({ product: { shaftFlex: "stiff" } }),
    );
    const putter = scoreResearchSimilarity(
      {
        ...input,
        brand: "Scotty Cameron",
        clubType: "putter",
        model: "Newport",
      },
      candidate({ title: "Scotty Cameron Newport putter x stiff" }),
    );
    expect(loft.score).toBeLessThan(
      scoreResearchSimilarity(input, candidate()).score,
    );
    expect(flex.score).toBeLessThan(
      scoreResearchSimilarity(input, candidate()).score,
    );
    expect(putter.score).toBeGreaterThanOrEqual(75);
  });

  it("expires saved research and preserves bounded call counts", async () => {
    const provider = {
      getMarketPrice: vi.fn(async () => ({
        medianPriceMxn: null,
        averagePriceMxn: null,
        lowPriceMxn: null,
        highPriceMxn: null,
        sampleSize: 0,
        confidence: "unavailable" as const,
        source: null,
        sourceUrl: null,
        checkedAt: new Date().toISOString(),
        provider: "qa",
        searchQuery: null,
        sources: [],
        excludedCount: 0,
      })),
    } as unknown as MarketPriceProvider;
    const result = await researchBestRoundIntelligence(input, {
      provider,
      now: new Date("2026-09-01T00:00:00Z"),
      savedResearch: [
        candidate({
          market: "SAVED_RESEARCH",
          observedAt: "2026-01-01T00:00:00Z",
        }),
      ],
      maxMexicoQueries: 2,
      maxUsaQueries: 1,
    });
    expect(result.cachedResearchUsed).toBe(false);
    expect(result.mexicoQueriesExecuted).toBe(2);
    expect(result.usaQueriesExecuted).toBe(1);
  });
});
