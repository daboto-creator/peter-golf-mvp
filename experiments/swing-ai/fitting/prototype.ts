export type PrototypeCategory =
  "DRIVER" | "FAIRWAY_WOOD" | "HYBRID" | "IRON" | "WEDGE" | "PUTTER";

export type PrototypeContext = {
  category: PrototypeCategory;
  handedness?: "RIGHT" | "LEFT";
  handicapKnown?: boolean;
  budgetMxnMinor?: number;
  videoConfidence?: number;
  videoIsOnlyMaterialEvidence?: boolean;
  currentDistancesYards?: number[];
  currentWedgeLofts?: number[];
  currentEquipmentAdequate?: boolean;
  categoryAnswers?: string[];
};

export type PrototypeCandidate = {
  id: string;
  category: PrototypeCategory;
  handedness?: "RIGHT" | "LEFT";
  priceMxnMinor: number;
  available: boolean;
  source: "FIRST_PARTY" | "MARKETPLACE";
  marketplaceStatus?: "APPROVED_ACTIVE" | "DRAFT" | "UNDER_REVIEW";
  loftDegrees?: number;
  expectedDistanceYards?: number;
  criticalSpecsComplete: boolean;
};

export type PrototypeDecision = {
  status:
    | "ELIGIBLE"
    | "INCOMPATIBLE"
    | "NEEDS_MORE_DATA"
    | "CURRENT_EQUIPMENT_ADEQUATE";
  reasonCodes: string[];
};

const CATEGORY_MINIMUM_ANSWERS: Record<PrototypeCategory, number> = {
  DRIVER: 2,
  FAIRWAY_WOOD: 2,
  HYBRID: 2,
  IRON: 2,
  WEDGE: 1,
  PUTTER: 2,
};

/** Discovery gate only: it deliberately calculates no customer-facing score. */
export function evaluatePrototypeCandidate(
  context: PrototypeContext,
  candidate: PrototypeCandidate,
): PrototypeDecision {
  const reasons: string[] = [];
  if (context.currentEquipmentAdequate)
    return {
      status: "CURRENT_EQUIPMENT_ADEQUATE",
      reasonCodes: ["CURRENT_EQUIPMENT_POTENTIALLY_ADEQUATE"],
    };
  if (candidate.category !== context.category)
    reasons.push("CATEGORY_MISMATCH");
  if (!candidate.available) reasons.push("PRODUCT_UNAVAILABLE");
  if (
    candidate.source === "MARKETPLACE" &&
    candidate.marketplaceStatus !== "APPROVED_ACTIVE"
  )
    reasons.push("MARKETPLACE_NOT_APPROVED_ACTIVE");
  if (
    context.handedness &&
    candidate.handedness &&
    context.handedness !== candidate.handedness
  )
    reasons.push("HANDEDNESS_INCOMPATIBLE");
  if (
    context.budgetMxnMinor !== undefined &&
    candidate.priceMxnMinor > context.budgetMxnMinor
  )
    reasons.push("OUTSIDE_BUDGET");
  if (reasons.length) return { status: "INCOMPATIBLE", reasonCodes: reasons };

  const missing: string[] = [];
  if (!context.handedness) missing.push("HANDEDNESS_REQUIRED");
  if (!context.handicapKnown) missing.push("HANDICAP_OR_LEVEL_REQUIRED");
  if (!candidate.criticalSpecsComplete)
    missing.push("CATALOG_CRITICAL_SPECS_MISSING");
  if (
    context.videoIsOnlyMaterialEvidence &&
    (context.videoConfidence === undefined || context.videoConfidence < 0.6)
  )
    missing.push("VIDEO_CONFIDENCE_INSUFFICIENT");
  if (
    (context.categoryAnswers?.length ?? 0) <
    CATEGORY_MINIMUM_ANSWERS[context.category]
  )
    missing.push("CATEGORY_CONTEXT_INCOMPLETE");

  if (
    context.category === "HYBRID" &&
    candidate.expectedDistanceYards !== undefined &&
    context.currentDistancesYards?.some(
      (distance) => Math.abs(distance - candidate.expectedDistanceYards!) <= 5,
    )
  )
    return {
      status: "INCOMPATIBLE",
      reasonCodes: ["HYBRID_DUPLICATES_EXISTING_DISTANCE"],
    };

  if (context.category === "WEDGE") {
    if (
      candidate.loftDegrees === undefined ||
      !context.currentWedgeLofts?.length
    )
      missing.push("WEDGE_LOFT_GAPPING_REQUIRED");
    else {
      const lofts = [...context.currentWedgeLofts, candidate.loftDegrees].sort(
        (left, right) => left - right,
      );
      const gaps = lofts.slice(1).map((loft, index) => loft - lofts[index]);
      if (gaps.some((gap) => gap < 3 || gap > 6))
        return {
          status: "INCOMPATIBLE",
          reasonCodes: ["WEDGE_LOFT_GAP_INAPPROPRIATE"],
        };
    }
  }
  if (context.category === "PUTTER" && !context.categoryAnswers?.length)
    missing.push("PUTTER_STROKE_OR_COMFORT_EVIDENCE_REQUIRED");
  return missing.length
    ? { status: "NEEDS_MORE_DATA", reasonCodes: [...new Set(missing)] }
    : { status: "ELIGIBLE", reasonCodes: ["CRITICAL_GATES_PASSED"] };
}
