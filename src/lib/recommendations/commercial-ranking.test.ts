import { describe, expect, it } from "vitest";

import type {
  EquipmentMatch,
  InventoryUnit,
  MiGolfProfile,
} from "@/lib/mi-golf/domain";
import {
  matchInventoryCandidates,
  rankInventoryCandidates,
  type RankableInventoryCandidate,
} from "@/lib/recommendations/commercial-ranking";

function match(
  score: number,
  confidence: EquipmentMatch["confidence"] = "HIGH",
  status: EquipmentMatch["status"] = "MATCH",
): EquipmentMatch {
  return {
    status,
    matchScore: status === "INCOMPATIBLE" ? 0 : score,
    confidence,
    category: "DRIVER",
    ruleVersion: "driver-v1",
    reasons: [],
    tradeoffs: [],
    missingData: [],
    nextBestQuestion: null,
  };
}

function candidate(
  id: string,
  score: number,
  overrides: Partial<InventoryUnit> & {
    confidence?: EquipmentMatch["confidence"];
    status?: EquipmentMatch["status"];
    tieBreak?: number;
  } = {},
): RankableInventoryCandidate {
  return {
    unit: {
      productId: overrides.productId ?? `product-${id}`,
      unitId: overrides.unitId ?? `unit-${id}`,
      canonicalModelId: overrides.canonicalModelId ?? `model-${id}`,
      source: overrides.source ?? "FIRST_PARTY",
      category: overrides.category ?? "DRIVER",
      brand: overrides.brand ?? "Neutral",
      model: overrides.model ?? `Model ${id}`,
      condition: overrides.condition ?? "new",
      priceMxnMinor: overrides.priceMxnMinor ?? 10_000,
      availability: overrides.availability ?? "AVAILABLE",
      stock: overrides.stock ?? 1,
      technicalSpecs: overrides.technicalSpecs ?? { handedness: "RIGHT" },
    },
    equipmentMatch: match(score, overrides.confidence, overrides.status),
    internalCommercialTieBreakSignal: overrides.tieBreak,
  };
}

function ids(result: ReturnType<typeof rankInventoryCandidates>) {
  return result.recommendations.map(({ candidate: unit }) => unit.unitId);
}

describe("inventory eligibility", () => {
  it.each([
    ["stock zero", { stock: 0 }],
    ["unavailable", { availability: "UNAVAILABLE" as const }],
    ["unknown availability", { availability: "UNKNOWN" as const }],
    [
      "fully reserved or sold representation",
      { stock: 0, availability: "UNAVAILABLE" as const },
    ],
  ])("excludes %s units", (_label, overrides) => {
    const result = rankInventoryCandidates([candidate("x", 90, overrides)]);
    expect(result.status).toBe("NO_CURRENT_MATCH");
    expect(result.recommendations).toEqual([]);
  });

  it("includes an available, priced unit", () => {
    expect(rankInventoryCandidates([candidate("x", 90)]).status).toBe(
      "RECOMMENDATIONS",
    );
  });
});

describe("technical dominance and bounded tie-break", () => {
  it("keeps Match 94 above Match 86 despite a stronger commercial signal", () => {
    expect(
      ids(
        rankInventoryCandidates([
          candidate("a", 94),
          candidate("b", 86, { tieBreak: 999 }),
        ]),
      )[0],
    ).toBe("unit-a");
  });

  it("allows the internal tie-break only within three Match points", () => {
    expect(
      ids(
        rankInventoryCandidates([
          candidate("a", 92),
          candidate("b", 90, { tieBreak: 10 }),
        ]),
      )[0],
    ).toBe("unit-b");
  });

  it("does not allow the tie-break outside three Match points", () => {
    expect(
      ids(
        rankInventoryCandidates([
          candidate("a", 92),
          candidate("b", 88, { tieBreak: 999 }),
        ]),
      )[0],
    ).toBe("unit-a");
  });

  it("can prefer high confidence 90 over low confidence 91 without changing Match", () => {
    const result = rankInventoryCandidates([
      candidate("low", 91, { confidence: "LOW" }),
      candidate("high", 90, { confidence: "HIGH" }),
    ]);
    expect(ids(result)[0]).toBe("unit-high");
    expect(
      result.recommendations.find(
        ({ candidate: unit }) => unit.unitId === "unit-low",
      )?.equipmentMatch.matchScore,
    ).toBe(91);
  });
});

describe("personal and commercial fit", () => {
  it("orders near-equivalent budget fits without changing technical Match", () => {
    const result = rankInventoryCandidates(
      [
        candidate("within", 90, { priceMxnMinor: 10_000 }),
        candidate("slight", 90, { priceMxnMinor: 10_500 }),
        candidate("above", 90, { priceMxnMinor: 15_000 }),
      ],
      { budgetMxnMinor: 10_000 },
    );
    expect(ids(result)[0]).toBe("unit-within");
    expect(
      result.recommendations.every(
        ({ equipmentMatch }) => equipmentMatch.matchScore === 90,
      ),
    ).toBe(true);
  });

  it("lets explicit brand preference order near-equivalent candidates only", () => {
    const result = rankInventoryCandidates(
      [
        candidate("other", 91, { brand: "Other" }),
        candidate("preferred", 90, { brand: "Titleist" }),
      ],
      { preferredBrands: ["Titleist"] },
    );
    expect(ids(result)[0]).toBe("unit-preferred");
    expect(result.recommendations[0].safeReasons).toContain("PREFERRED_BRAND");
  });

  it("does not assume used is worse when condition preference is unknown", () => {
    const result = rankInventoryCandidates([
      candidate("used", 90, { condition: "used" }),
      candidate("new", 90, { condition: "new" }),
    ]);
    expect(
      result.recommendations.every(
        ({ personalFit }) => personalFit.score === 50,
      ),
    ).toBe(true);
  });

  it("honors an explicit new-only condition preference", () => {
    const result = rankInventoryCandidates(
      [candidate("used", 95, { condition: "used" }), candidate("new", 80)],
      { conditionPreference: "NEW_ONLY" },
    );
    expect(ids(result)).toEqual(["unit-new"]);
  });
});

describe("recommendation set", () => {
  it("selects a cheaper, technically acceptable Best Value", () => {
    const result = rankInventoryCandidates([
      candidate("best", 94, { priceMxnMinor: 20_000 }),
      candidate("value", 80, { priceMxnMinor: 14_000 }),
      candidate("cheap-weak", 62, { priceMxnMinor: 5_000 }),
    ]);
    expect(
      result.recommendations.find(({ role }) => role === "BEST_VALUE")
        ?.candidate.unitId,
    ).toBe("unit-value");
  });

  it("returns at most three unique products with unique roles", () => {
    const result = rankInventoryCandidates([
      candidate("a", 95),
      candidate("b", 90, { priceMxnMinor: 8_000 }),
      candidate("c", 85),
      candidate("d", 80),
      candidate("a-duplicate", 99, { productId: "product-a" }),
    ]);
    expect(result.recommendations).toHaveLength(3);
    expect(
      new Set(
        result.recommendations.map(({ candidate: unit }) => unit.productId),
      ).size,
    ).toBe(3);
    expect(new Set(result.recommendations.map(({ role }) => role)).size).toBe(
      3,
    );
  });

  it.each([1, 2])(
    "returns only %i responsible candidates when only that many exist",
    (count) => {
      const result = rankInventoryCandidates(
        Array.from({ length: count }, (_, index) =>
          candidate(String(index), 90 - index),
        ),
      );
      expect(result.recommendations).toHaveLength(count);
    },
  );

  it.each([
    ["all incompatible", [candidate("x", 90, { status: "INCOMPATIBLE" })]],
    ["all below threshold", [candidate("x", 59)]],
  ])("returns NO_CURRENT_MATCH for %s", (_label, candidates) => {
    const result = rankInventoryCandidates(candidates);
    expect(result.status).toBe("NO_CURRENT_MATCH");
    expect(result.noMatch?.futureAlertMatchFloor).toBe(85);
  });
});

describe("privacy, determinism, and PR76 integration", () => {
  it("never exposes raw internal financial inputs in the safe output", () => {
    const serialized = JSON.stringify(
      rankInventoryCandidates([candidate("x", 90, { tieBreak: 999 })]),
    );
    for (const forbidden of [
      "cost",
      "margin",
      "grossProfit",
      "commission",
      "internalCommercialTieBreakSignal",
    ])
      expect(serialized).not.toContain(forbidden);
  });

  it("is invariant to candidate input order", () => {
    const candidates = [
      candidate("a", 94),
      candidate("b", 92, { tieBreak: 5 }),
      candidate("c", 80, { priceMxnMinor: 7_000 }),
    ];
    expect(rankInventoryCandidates(candidates)).toEqual(
      rankInventoryCandidates([candidates[2], candidates[0], candidates[1]]),
    );
  });

  it("does not prefer an ownership channel", () => {
    const firstParty = candidate("first", 90, { source: "FIRST_PARTY" });
    const marketplace = candidate("market", 90, { source: "MARKETPLACE" });
    const firstResult = rankInventoryCandidates([firstParty, marketplace]);
    const swappedSources = rankInventoryCandidates([
      { ...firstParty, unit: { ...firstParty.unit, source: "MARKETPLACE" } },
      { ...marketplace, unit: { ...marketplace.unit, source: "FIRST_PARTY" } },
    ]);
    expect(ids(firstResult)).toEqual(ids(swappedSources));
  });

  it("uses PR76 matchEquipment and preserves its result byte-for-byte", () => {
    const golfer: MiGolfProfile = {
      userId: "golfer",
      handicap: 20,
      handedness: "RIGHT",
      skillLevel: "INTERMEDIATE",
      playFrequency: "WEEKLY",
      shotTendency: "STRAIGHT",
      preferences: {},
      source: "USER_DECLARED",
      confidence: "HIGH",
    };
    const matched = matchInventoryCandidates({
      golfer,
      currentEquipment: [],
      objectives: [],
      units: [candidate("x", 0).unit],
    });
    const before = structuredClone(matched[0].equipmentMatch);
    const ranked = rankInventoryCandidates(matched);
    expect(ranked.recommendations[0].equipmentMatch).toEqual(before);
    expect(matched[0].equipmentMatch.ruleVersion).toBe("driver-v1");
  });
});
