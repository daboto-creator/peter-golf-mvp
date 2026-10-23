import { describe, expect, it } from "vitest";
import {
  evaluatePrototypeCandidate,
  type PrototypeCandidate,
  type PrototypeContext,
} from "./prototype";

const context: PrototypeContext = {
  category: "DRIVER",
  handedness: "RIGHT",
  handicapKnown: true,
  budgetMxnMinor: 1_000_000,
  categoryAnswers: ["accuracy", "variable-contact"],
};
const candidate: PrototypeCandidate = {
  id: "candidate-1",
  category: "DRIVER",
  handedness: "RIGHT",
  priceMxnMinor: 800_000,
  available: true,
  source: "FIRST_PARTY",
  criticalSpecsComplete: true,
};

describe("Swing AI discovery fitting gates", () => {
  it("accepts supported candidates in all six mandatory categories", () => {
    const categories: PrototypeContext["category"][] = [
      "DRIVER",
      "FAIRWAY_WOOD",
      "HYBRID",
      "IRON",
      "WEDGE",
      "PUTTER",
    ];
    for (const category of categories) {
      expect(
        evaluatePrototypeCandidate(
          {
            ...context,
            category,
            currentWedgeLofts: category === "WEDGE" ? [46, 52] : undefined,
          },
          {
            ...candidate,
            category,
            loftDegrees: category === "WEDGE" ? 58 : undefined,
          },
        ).status,
        category,
      ).toBe("ELIGIBLE");
    }
  });

  it("rejects opposite hand and a driver outside budget", () => {
    expect(
      evaluatePrototypeCandidate(context, {
        ...candidate,
        handedness: "LEFT",
      }).reasonCodes,
    ).toContain("HANDEDNESS_INCOMPATIBLE");
    expect(
      evaluatePrototypeCandidate(context, {
        ...candidate,
        priceMxnMinor: 1_200_000,
      }).reasonCodes,
    ).toContain("OUTSIDE_BUDGET");
  });

  it("rejects a hybrid that duplicates an existing distance", () => {
    expect(
      evaluatePrototypeCandidate(
        {
          ...context,
          category: "HYBRID",
          currentDistancesYards: [170, 185, 200],
        },
        { ...candidate, category: "HYBRID", expectedDistanceYards: 188 },
      ).reasonCodes,
    ).toContain("HYBRID_DUPLICATES_EXISTING_DISTANCE");
  });

  it("rejects inappropriate wedge loft gapping", () => {
    expect(
      evaluatePrototypeCandidate(
        {
          ...context,
          category: "WEDGE",
          categoryAnswers: ["neutral"],
          currentWedgeLofts: [46, 52],
        },
        { ...candidate, category: "WEDGE", loftDegrees: 54 },
      ).reasonCodes,
    ).toContain("WEDGE_LOFT_GAP_INAPPROPRIATE");
  });

  it("requires more evidence before recommending a putter", () => {
    const result = evaluatePrototypeCandidate(
      { ...context, category: "PUTTER", categoryAnswers: [] },
      { ...candidate, category: "PUTTER" },
    );
    expect(result.status).toBe("NEEDS_MORE_DATA");
    expect(result.reasonCodes).toContain(
      "PUTTER_STROKE_OR_COMFORT_EVIDENCE_REQUIRED",
    );
  });

  it("rejects unavailable and unapproved Marketplace products", () => {
    expect(
      evaluatePrototypeCandidate(context, {
        ...candidate,
        available: false,
      }).reasonCodes,
    ).toContain("PRODUCT_UNAVAILABLE");
    expect(
      evaluatePrototypeCandidate(context, {
        ...candidate,
        source: "MARKETPLACE",
        marketplaceStatus: "DRAFT",
      }).reasonCodes,
    ).toContain("MARKETPLACE_NOT_APPROVED_ACTIVE");
  });

  it("flags incomplete profile, catalog, and low-confidence video", () => {
    const result = evaluatePrototypeCandidate(
      {
        category: "IRON",
        videoConfidence: 0.3,
        videoIsOnlyMaterialEvidence: true,
      },
      { ...candidate, category: "IRON", criticalSpecsComplete: false },
    );
    expect(result.status).toBe("NEEDS_MORE_DATA");
    expect(result.reasonCodes).toEqual(
      expect.arrayContaining([
        "HANDEDNESS_REQUIRED",
        "HANDICAP_OR_LEVEL_REQUIRED",
        "CATALOG_CRITICAL_SPECS_MISSING",
        "VIDEO_CONFIDENCE_INSUFFICIENT",
      ]),
    );
  });

  it("keeps adequate current equipment and never fabricates an alternative", () => {
    expect(
      evaluatePrototypeCandidate(
        { ...context, currentEquipmentAdequate: true },
        candidate,
      ).status,
    ).toBe("CURRENT_EQUIPMENT_ADEQUATE");
    const candidates = [
      { ...candidate, available: false },
      { ...candidate, id: "candidate-2", handedness: "LEFT" as const },
    ];
    expect(
      candidates.filter(
        (item) =>
          evaluatePrototypeCandidate(context, item).status === "ELIGIBLE",
      ),
    ).toHaveLength(0);
  });
});
