import { describe, expect, it } from "vitest";

import { CATEGORY_MATCH_PROFILES } from "@/lib/matching/category-match-profiles";
import {
  matchEquipment,
  matchEquipmentUnits,
} from "@/lib/matching/equipment-matching";
import type {
  EquipmentMatchInput,
  EquipmentUnit,
  MatchCategory,
  MiGolfEquipment,
  MiGolfObjective,
  MiGolfProfile,
} from "@/lib/mi-golf/domain";

const profile: MiGolfProfile = {
  userId: "golfer-1",
  handicap: 28,
  handedness: "RIGHT",
  skillLevel: "BEGINNER",
  playFrequency: "WEEKLY",
  shotTendency: "SLICE",
  preferences: {},
  source: "USER_DECLARED",
  confidence: "HIGH",
};

function unit(
  category: MatchCategory,
  specifications: EquipmentUnit["specifications"] = {},
): EquipmentUnit {
  return {
    id: `${category.toLowerCase()}-unit`,
    category,
    brand: "Test Brand",
    model: "Explicit Model",
    canonicalModelId: "canonical-model",
    condition: "used",
    source: "EXTERNAL_SOURCE",
    confidence: "HIGH",
    specifications: { handedness: "RIGHT", ...specifications },
  };
}

function current(
  category: string,
  specifications: Record<string, unknown>,
): MiGolfEquipment {
  return {
    id: `current-${category}-${String(specifications.loftDegrees ?? "none")}`,
    userId: "golfer-1",
    category,
    brand: null,
    model: null,
    specifications,
    source: "USER_DECLARED",
    confidence: "HIGH",
    notes: null,
    isActive: true,
  };
}

function objective(objectiveType: string): MiGolfObjective {
  return {
    id: `objective-${objectiveType}`,
    userId: "golfer-1",
    objectiveType,
    status: "ACTIVE",
    details: null,
    source: "USER_DECLARED",
    confidence: "HIGH",
  };
}

function input(
  category: MatchCategory,
  specifications: EquipmentUnit["specifications"] = {},
  overrides: Partial<EquipmentMatchInput> = {},
): EquipmentMatchInput {
  return {
    golfer: profile,
    currentEquipment: [],
    objectives: [objective("more forgiveness")],
    equipmentUnit: unit(category, specifications),
    ...overrides,
  };
}

describe("equipment matching invariants", () => {
  it("returns identical deterministic output for identical input", () => {
    const request = input("DRIVER", {
      loftDegrees: 10.5,
      shaftFlex: "regular",
      forgiveness: "HIGH",
      drawBias: true,
    });
    expect(matchEquipment(request)).toEqual(matchEquipment(request));
  });

  it("always bounds scores and exposes category rule versions", () => {
    const categories = Object.keys(CATEGORY_MATCH_PROFILES) as MatchCategory[];
    const results = matchEquipmentUnits(
      categories.map((category) =>
        input(category, {
          loftDegrees: category === "WEDGE" ? 54 : 10.5,
          shaftFlex: "regular",
          forgiveness: "HIGH",
          bounceDegrees: category === "WEDGE" ? 12 : null,
          grind: category === "WEDGE" ? "M" : null,
          putterHeadType: category === "PUTTER" ? "MALLET" : null,
          lengthInches: category === "PUTTER" ? 34 : null,
          setMakeup:
            category === "IRON" ? ["5", "6", "7", "8", "9", "PW"] : null,
        }),
      ),
    );
    results.forEach((result) => {
      expect(result.matchScore).toBeGreaterThanOrEqual(0);
      expect(result.matchScore).toBeLessThanOrEqual(100);
      expect(result.ruleVersion).toBe(
        `${result.category === "FAIRWAY_WOOD" ? "fairway" : result.category === "IRON" ? "irons" : result.category.toLowerCase()}-v1`,
      );
    });
  });

  it.each([
    "DRIVER",
    "FAIRWAY_WOOD",
    "HYBRID",
    "IRON",
    "WEDGE",
    "PUTTER",
  ] as const)(
    "treats an actual wrong-handed %s unit as incompatible",
    (category) => {
      const result = matchEquipment(input(category, { handedness: "LEFT" }));
      expect(result.status).toBe("INCOMPATIBLE");
      expect(result.matchScore).toBe(0);
      expect(result.reasons[0].code).toBe("HANDEDNESS_MISMATCH");
    },
  );

  it("does not invent incompatibility for unknown handedness", () => {
    const result = matchEquipment(
      input(
        "DRIVER",
        { handedness: null },
        { golfer: { ...profile, handedness: "UNKNOWN" } },
      ),
    );
    expect(result.status).toBe("MATCH");
    expect(result.confidence).toBe("LOW");
    expect(result.missingData.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "GOLFER_HANDEDNESS_MISSING",
        "UNIT_HANDEDNESS_MISSING",
      ]),
    );
    expect(result.nextBestQuestion?.id).toBe("handedness");
  });

  it("does not lower Match merely because neutral technical data is missing", () => {
    const known = matchEquipment(
      input("DRIVER", { handedness: "RIGHT", loftDegrees: 9.5 }),
    );
    const unknown = matchEquipment(
      input("DRIVER", { handedness: "RIGHT", loftDegrees: null }),
    );
    expect(unknown.matchScore).toBe(known.matchScore);
    expect(unknown.missingData.length).toBeGreaterThan(
      known.missingData.length,
    );
  });

  it("ignores price, margin, promotion and inventory age", () => {
    const technical = unit("DRIVER", {
      loftDegrees: 10.5,
      shaftFlex: "regular",
    });
    const cheap = {
      ...technical,
      price: 100,
      margin: 5,
      promotion: true,
      inventoryAgeDays: 500,
    } as EquipmentUnit;
    const expensive = {
      ...technical,
      price: 999999,
      margin: 90000,
      promotion: false,
      inventoryAgeDays: 1,
    } as EquipmentUnit;
    expect(
      matchEquipment({ ...input("DRIVER"), equipmentUnit: cheap }),
    ).toEqual(matchEquipment({ ...input("DRIVER"), equipmentUnit: expensive }));
  });

  it("ignores brand preference and unit condition", () => {
    const first = input(
      "DRIVER",
      { loftDegrees: 10.5 },
      {
        golfer: { ...profile, preferences: { favoriteBrand: "Brand A" } },
        equipmentUnit: {
          ...unit("DRIVER", { loftDegrees: 10.5 }),
          condition: "new",
        },
      },
    );
    const second = {
      ...first,
      golfer: { ...profile, preferences: { favoriteBrand: "Brand B" } },
      equipmentUnit: { ...first.equipmentUnit, condition: "used" },
    };
    expect(matchEquipment(first)).toEqual(matchEquipment(second));
  });
});

describe("driver rules", () => {
  it("rewards an explicitly forgiving higher-loft setup for a beginner", () => {
    const forgiving = matchEquipment(
      input("DRIVER", {
        loftDegrees: 10.5,
        forgiveness: "HIGH",
        playerProfile: "IMPROVING",
      }),
    );
    const demanding = matchEquipment(
      input("DRIVER", {
        loftDegrees: 8,
        forgiveness: "LOW",
        playerProfile: "TOUR",
      }),
    );
    expect(forgiving.matchScore).toBeGreaterThan(demanding.matchScore);
    expect(forgiving.reasons.map((reason) => reason.code)).toContain(
      "FORGIVENESS_SUPPORTS_PLAYER",
    );
    expect(demanding.tradeoffs.map((reason) => reason.code)).toContain(
      "DEMANDING_PROFILE_FOR_PLAYER",
    );
  });

  it("supports a stronger player only from explicit player and shaft evidence", () => {
    const result = matchEquipment(
      input(
        "DRIVER",
        { loftDegrees: 9, playerProfile: "ADVANCED", shaftFlex: "stiff" },
        {
          golfer: {
            ...profile,
            handicap: 5,
            skillLevel: "ADVANCED",
            shotTendency: "STRAIGHT",
          },
          measurements: {
            swingSpeedMph: {
              value: 103,
              source: "MEASURED",
              confidence: "HIGH",
            },
          },
        },
      ),
    );
    expect(result.reasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining(["PLAYER_PROFILE_ALIGNED", "SHAFT_FLEX_ALIGNED"]),
    );
  });

  it("uses explicit draw bias for slice compatibility and not a model name", () => {
    const supported = matchEquipment(input("DRIVER", { drawBias: true }));
    const nameOnly = matchEquipment({
      ...input("DRIVER"),
      equipmentUnit: { ...unit("DRIVER"), model: "Marketing Draw Driver" },
    });
    expect(supported.reasons.map((reason) => reason.code)).toContain(
      "EXPLICIT_DRAW_BIAS_SUPPORTS_SLICE",
    );
    expect(nameOnly.reasons.map((reason) => reason.code)).not.toContain(
      "EXPLICIT_DRAW_BIAS_SUPPORTS_SLICE",
    );
  });

  it("surfaces unknown shot tendency and missing loft without crashing", () => {
    const result = matchEquipment(
      input(
        "DRIVER",
        { loftDegrees: null },
        { golfer: { ...profile, shotTendency: null } },
      ),
    );
    expect(result.status).toBe("MATCH");
    expect(result.missingData.map((item) => item.code)).toEqual(
      expect.arrayContaining(["SHOT_TENDENCY_MISSING", "DRIVER_LOFT_MISSING"]),
    );
  });

  it("reports a measured shaft-flex mismatch as a tradeoff", () => {
    const result = matchEquipment(
      input(
        "DRIVER",
        { shaftFlex: "senior" },
        {
          measurements: {
            swingSpeedMph: {
              value: 105,
              source: "MEASURED",
              confidence: "HIGH",
            },
          },
        },
      ),
    );
    expect(result.tradeoffs.map((reason) => reason.code)).toContain(
      "SHAFT_FLEX_MISMATCH",
    );
  });
});

describe("fairway and hybrid rules", () => {
  it("detects conservative fairway loft redundancy", () => {
    const result = matchEquipment(
      input(
        "FAIRWAY_WOOD",
        { loftDegrees: 16, shaftFlex: "regular" },
        {
          currentEquipment: [current("fairway wood", { loftDegrees: 15 })],
        },
      ),
    );
    expect(result.tradeoffs.map((reason) => reason.code)).toContain(
      "BAG_LOFT_REDUNDANCY",
    );
  });

  it("recognizes a fairway loft that fills an obvious structural gap", () => {
    const result = matchEquipment(
      input(
        "FAIRWAY_WOOD",
        { loftDegrees: 19 },
        {
          currentEquipment: [
            current("fairway wood", { loftDegrees: 14 }),
            current("hybrid", { loftDegrees: 24 }),
          ],
        },
      ),
    );
    expect(result.reasons.map((reason) => reason.code)).toContain(
      "BAG_LOFT_GAP_FILLED",
    );
  });

  it("uses an active long-iron replacement objective for hybrid", () => {
    const active = matchEquipment(
      input(
        "HYBRID",
        { loftDegrees: 22 },
        { objectives: [objective("replace long iron")] },
      ),
    );
    const inactiveObjective = {
      ...objective("replace long iron"),
      status: "ACHIEVED" as const,
    };
    const inactive = matchEquipment(
      input("HYBRID", { loftDegrees: 22 }, { objectives: [inactiveObjective] }),
    );
    expect(active.matchScore).toBeGreaterThan(inactive.matchScore);
    expect(active.reasons.map((reason) => reason.code)).toContain(
      "LONG_IRON_REPLACEMENT_OBJECTIVE",
    );
  });

  it("returns missing bag and loft context explicitly", () => {
    const result = matchEquipment(input("HYBRID", { loftDegrees: null }));
    expect(result.missingData.map((item) => item.code)).toEqual(
      expect.arrayContaining(["CLUB_LOFT_MISSING", "BAG_GAP_CONTEXT_MISSING"]),
    );
  });
});

describe("iron rules", () => {
  it("flags a demanding long-iron configuration for a beginner", () => {
    const result = matchEquipment(
      input("IRON", {
        forgiveness: "LOW",
        playerProfile: "TOUR",
        setMakeup: ["3", "4", "5", "6", "7", "8", "9", "PW"],
      }),
    );
    expect(result.tradeoffs.map((reason) => reason.code)).toEqual(
      expect.arrayContaining([
        "DEMANDING_PROFILE_FOR_PLAYER",
        "LONG_IRON_SET_COMPOSITION_TRADEOFF",
      ]),
    );
  });

  it("keeps lie and length fitting uncertainty in confidence rather than Match", () => {
    const result = matchEquipment(
      input("IRON", {
        shaftFlex: "regular",
        setMakeup: ["5", "6", "7", "8", "9", "PW"],
      }),
    );
    expect(result.status).toBe("MATCH");
    expect(result.missingData.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "IRON_LIE_FIT_UNCONFIRMED",
        "IRON_LENGTH_FIT_UNCONFIRMED",
      ]),
    );
  });
});

describe("wedge rules", () => {
  it("distinguishes a filled loft gap from a duplicate loft", () => {
    const bag = [
      current("wedge", { loftDegrees: 46 }),
      current("wedge", { loftDegrees: 56 }),
    ];
    const gap = matchEquipment(
      input("WEDGE", { loftDegrees: 52 }, { currentEquipment: bag }),
    );
    const duplicate = matchEquipment(
      input("WEDGE", { loftDegrees: 55 }, { currentEquipment: bag }),
    );
    expect(gap.reasons.map((reason) => reason.code)).toContain(
      "BAG_LOFT_GAP_FILLED",
    );
    expect(duplicate.tradeoffs.map((reason) => reason.code)).toContain(
      "BAG_LOFT_REDUNDANCY",
    );
  });

  it("uses known bounce only with declared turf interaction", () => {
    const known = matchEquipment(
      input(
        "WEDGE",
        { loftDegrees: 54, bounceDegrees: 12, grind: "M" },
        {
          currentEquipment: [current("wedge", { loftDegrees: 48 })],
          measurements: {
            turfInteraction: {
              value: "STEEP",
              source: "USER_DECLARED",
              confidence: "HIGH",
            },
          },
        },
      ),
    );
    const unknown = matchEquipment(
      input(
        "WEDGE",
        { loftDegrees: 54, bounceDegrees: 12, grind: "M" },
        {
          currentEquipment: [current("wedge", { loftDegrees: 48 })],
        },
      ),
    );
    expect(known.reasons.map((reason) => reason.code)).toContain(
      "WEDGE_BOUNCE_SUPPORTS_STEEP_DELIVERY",
    );
    expect(unknown.tradeoffs.map((reason) => reason.code)).toContain(
      "WEDGE_PRO_FITTING_CONTEXT_REQUIRED",
    );
    expect(unknown.nextBestQuestion?.id).toBe("turfInteraction");
  });
});

describe("putter rules", () => {
  it("uses explicit stroke and length properties when known", () => {
    const result = matchEquipment(
      input(
        "PUTTER",
        { putterHeadType: "MALLET", strokeFit: "SLIGHT_ARC", lengthInches: 34 },
        {
          measurements: {
            strokeType: {
              value: "SLIGHT_ARC",
              source: "MEASURED",
              confidence: "HIGH",
            },
            putterLengthInches: {
              value: 34,
              source: "USER_DECLARED",
              confidence: "HIGH",
            },
          },
        },
      ),
    );
    expect(result.reasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining([
        "PUTTER_STROKE_PROFILE_ALIGNED",
        "PUTTER_LENGTH_CONTEXT_ALIGNED",
      ]),
    );
  });

  it("surfaces missing stroke and length and recommends professional validation", () => {
    const result = matchEquipment(input("PUTTER", { putterHeadType: "BLADE" }));
    expect(result.missingData.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "PUTTER_STROKE_MISSING",
        "PUTTER_LENGTH_MISSING",
      ]),
    );
    expect(result.tradeoffs.map((reason) => reason.code)).toContain(
      "PUTTER_PRO_FITTING_RECOMMENDED",
    );
    expect(result.confidence).not.toBe("HIGH");
  });
});

describe("confidence and source quality", () => {
  const completeDriverSpecs = {
    handedness: "RIGHT" as const,
    loftDegrees: 10.5,
    shaftFlex: "regular",
    forgiveness: "HIGH" as const,
  };

  it("gives complete user-declared evidence higher confidence", () => {
    const result = matchEquipment(input("DRIVER", completeDriverSpecs));
    expect(result.confidence).toBe("HIGH");
  });

  it("reduces confidence for system-inferred profile facts without changing Match", () => {
    const declared = matchEquipment(input("DRIVER", completeDriverSpecs));
    const inferred = matchEquipment(
      input("DRIVER", completeDriverSpecs, {
        golfer: { ...profile, source: "SYSTEM_INFERRED", confidence: "LOW" },
      }),
    );
    expect(inferred.matchScore).toBe(declared.matchScore);
    expect(inferred.confidence).not.toBe("HIGH");
  });

  it("does not make measured data HIGH when critical fields remain missing", () => {
    const result = matchEquipment(
      input(
        "DRIVER",
        { ...completeDriverSpecs, handedness: null },
        {
          golfer: { ...profile, handedness: "UNKNOWN", source: "MEASURED" },
          measurements: {
            swingSpeedMph: {
              value: 90,
              source: "MEASURED",
              confidence: "HIGH",
            },
          },
        },
      ),
    );
    expect(result.confidence).toBe("LOW");
  });
});
