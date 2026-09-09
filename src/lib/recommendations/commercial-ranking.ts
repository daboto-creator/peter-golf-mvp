import type {
  BudgetFit,
  CommercialFit,
  EquipmentMatch,
  EquipmentMatchInput,
  EquipmentMatchMeasurements,
  InventoryCandidate,
  InventoryUnit,
  MiGolfEquipment,
  MiGolfObjective,
  MiGolfProfile,
  PersonalFit,
  ValueClass,
} from "@/lib/mi-golf/domain";
import { matchEquipment } from "@/lib/matching/equipment-matching";

export const COMMERCIAL_RANKING_VERSION = "commercial-ranking-v1";
export const RESPONSIBLE_MATCH_FLOOR = 60;
export const BEST_VALUE_MATCH_FLOOR = 70;
export const NEAR_EQUIVALENT_MATCH_POINTS = 3;
export const FUTURE_ALERT_MATCH_FLOOR = 85;
const SLIGHTLY_ABOVE_BUDGET_PERCENT = 10;
const MEANINGFULLY_CHEAPER_PERCENT = 15;

export type ConditionPreference =
  "NEW_ONLY" | "USED_ACCEPTABLE" | "PREFER_USED_VALUE" | "UNKNOWN";
export type PurchaseIntent = "BUY_NOW" | "EXPLORING";
export type RecommendationRole = "BEST_OPTION" | "BEST_VALUE" | "ALTERNATIVE";
export type SafeRankingReason =
  | "BEST_TECHNICAL_MATCH"
  | "BEST_RESPONSIBLE_OPTION"
  | "BEST_VALUE"
  | "PREFERRED_BRAND"
  | "WITHIN_BUDGET"
  | "USED_VALUE_OPTION"
  | "SLIGHTLY_ABOVE_BUDGET"
  | "LOWER_CONFIDENCE"
  | "LIMITED_AVAILABILITY";

export type RankingPreferences = {
  budgetMxnMinor?: number | null;
  preferredBrands?: string[];
  conditionPreference?: ConditionPreference;
  purchaseIntent?: PurchaseIntent;
};

/** Server-only callers may derive this integer without exposing raw economics. */
export type RankableInventoryCandidate = InventoryCandidate & {
  internalCommercialTieBreakSignal?: number;
};

export type RankedRecommendationCandidate = {
  candidate: InventoryUnit;
  equipmentMatch: EquipmentMatch;
  personalFit: PersonalFit;
  commercialFit: CommercialFit;
  rank: number;
  role: RecommendationRole;
  safeReasons: SafeRankingReason[];
};

export type CommercialRankingResult = {
  status: "RECOMMENDATIONS" | "NO_CURRENT_MATCH";
  ruleVersion: typeof COMMERCIAL_RANKING_VERSION;
  recommendations: RankedRecommendationCandidate[];
  noMatch: null | {
    reason:
      | "EMPTY_INVENTORY"
      | "NO_AVAILABLE_UNITS"
      | "NO_TECHNICALLY_RESPONSIBLE_UNIT";
    responsibleMatchFloor: number;
    futureAlertMatchFloor: number;
  };
};

export type MatchInventoryInput = {
  golfer: MiGolfProfile | null;
  currentEquipment: MiGolfEquipment[];
  objectives: MiGolfObjective[];
  measurements?: EquipmentMatchMeasurements;
  units: InventoryUnit[];
};

function normalize(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase("es-MX") ?? "";
}

function confidenceRank(confidence: EquipmentMatch["confidence"]) {
  return confidence === "HIGH" ? 3 : confidence === "MEDIUM" ? 2 : 1;
}

function budgetRank(fit: BudgetFit) {
  if (fit === "WITHIN_BUDGET") return 4;
  if (fit === "UNKNOWN") return 3;
  if (fit === "SLIGHTLY_ABOVE") return 2;
  return 1;
}

function valueRank(value: ValueClass) {
  if (value === "BEST") return 5;
  if (value === "GOOD") return 4;
  if (value === "STANDARD") return 3;
  if (value === "UNKNOWN") return 2;
  return 1;
}

function budgetFit(
  price: number | null,
  budget: number | null | undefined,
): BudgetFit {
  if (price === null || !budget || budget <= 0) return "UNKNOWN";
  if (price <= budget) return "WITHIN_BUDGET";
  const slightLimit =
    budget + Math.trunc((budget * SLIGHTLY_ABOVE_BUDGET_PERCENT) / 100);
  return price <= slightLimit ? "SLIGHTLY_ABOVE" : "MATERIALLY_ABOVE";
}

function personalFit(
  unit: InventoryUnit,
  preferences: RankingPreferences,
): PersonalFit {
  const brands = new Set((preferences.preferredBrands ?? []).map(normalize));
  const brandPreferenceMatched = Boolean(
    normalize(unit.brand) && brands.has(normalize(unit.brand)),
  );
  const preference = preferences.conditionPreference ?? "UNKNOWN";
  const condition = normalize(unit.condition);
  const conditionPreferenceMatched =
    (preference === "NEW_ONLY" && condition === "new") ||
    (preference === "PREFER_USED_VALUE" && condition === "used") ||
    (preference === "USED_ACCEPTABLE" &&
      (condition === "new" || condition === "used"));
  const reasons: PersonalFit["reasons"] = [];
  if (brandPreferenceMatched) reasons.push("PREFERRED_BRAND");
  if (conditionPreferenceMatched) reasons.push("CONDITION_PREFERENCE_MATCH");
  else if (preference === "UNKNOWN") reasons.push("CONDITION_ACCEPTABLE");
  return {
    score: Math.min(
      100,
      50 +
        (brandPreferenceMatched ? 30 : 0) +
        (conditionPreferenceMatched ? 20 : 0),
    ),
    reasons,
    brandPreferenceMatched,
    conditionPreferenceMatched,
  };
}

function medianPrice(candidates: RankableInventoryCandidate[]) {
  const prices = candidates
    .map(({ unit }) => unit.priceMxnMinor)
    .filter((price): price is number => price !== null)
    .sort((a, b) => a - b);
  if (prices.length === 0) return null;
  return prices[Math.trunc((prices.length - 1) / 2)];
}

function valueClass(
  candidate: RankableInventoryCandidate,
  median: number | null,
): ValueClass {
  const price = candidate.unit.priceMxnMinor;
  if (price === null || median === null || median <= 0) return "UNKNOWN";
  if (candidate.equipmentMatch.matchScore < BEST_VALUE_MATCH_FLOOR)
    return "WEAK";
  if (price * 100 <= median * 80) return "BEST";
  if (price <= median) return "GOOD";
  return "STANDARD";
}

type Evaluated = RankableInventoryCandidate & {
  personalFit: PersonalFit;
  commercialFit: CommercialFit;
};

function evaluate(
  candidates: RankableInventoryCandidate[],
  preferences: RankingPreferences,
): Evaluated[] {
  const median = medianPrice(candidates);
  return candidates.map((candidate) => ({
    ...candidate,
    personalFit: personalFit(candidate.unit, preferences),
    commercialFit: {
      budgetFit: budgetFit(
        candidate.unit.priceMxnMinor,
        preferences.budgetMxnMinor,
      ),
      valueClass: valueClass(candidate, median),
      availability: candidate.unit.availability,
      commercialTieBreakEligible: false,
    },
  }));
}

function stableKey(candidate: Evaluated) {
  return `${candidate.unit.productId}:${candidate.unit.unitId}`;
}

function nonTechnicalCompare(left: Evaluated, right: Evaluated) {
  const confidence =
    confidenceRank(right.equipmentMatch.confidence) -
    confidenceRank(left.equipmentMatch.confidence);
  if (confidence) return confidence;
  const budget =
    budgetRank(right.commercialFit.budgetFit) -
    budgetRank(left.commercialFit.budgetFit);
  if (budget) return budget;
  const personal = right.personalFit.score - left.personalFit.score;
  if (personal) return personal;
  const value =
    valueRank(right.commercialFit.valueClass) -
    valueRank(left.commercialFit.valueClass);
  if (value) return value;
  const internal =
    Math.trunc(right.internalCommercialTieBreakSignal ?? 0) -
    Math.trunc(left.internalCommercialTieBreakSignal ?? 0);
  if (internal) return internal;
  const match =
    right.equipmentMatch.matchScore - left.equipmentMatch.matchScore;
  return match || stableKey(left).localeCompare(stableKey(right), "en");
}

/**
 * Selects deterministically from a <=3 point technical band. A candidate more
 * than three Match points below the current technical leader cannot overtake it.
 */
function responsibleOrder(candidates: Evaluated[]) {
  const remaining = [...candidates].sort(
    (a, b) =>
      b.equipmentMatch.matchScore - a.equipmentMatch.matchScore ||
      stableKey(a).localeCompare(stableKey(b), "en"),
  );
  const ordered: Evaluated[] = [];
  while (remaining.length) {
    const leaderScore = remaining[0].equipmentMatch.matchScore;
    const band = remaining.filter(
      (candidate) =>
        leaderScore - candidate.equipmentMatch.matchScore <=
        NEAR_EQUIVALENT_MATCH_POINTS,
    );
    band.sort(nonTechnicalCompare);
    const winner = band[0];
    winner.commercialFit = {
      ...winner.commercialFit,
      commercialTieBreakEligible: band.length > 1,
    };
    ordered.push(winner);
    remaining.splice(remaining.indexOf(winner), 1);
  }
  return ordered;
}

function reasonsFor(
  candidate: Evaluated,
  role: RecommendationRole,
  highestTechnicalScore: number,
): SafeRankingReason[] {
  const reasons: SafeRankingReason[] = [];
  if (role === "BEST_OPTION")
    reasons.push(
      candidate.equipmentMatch.matchScore === highestTechnicalScore
        ? "BEST_TECHNICAL_MATCH"
        : "BEST_RESPONSIBLE_OPTION",
    );
  if (role === "BEST_VALUE") reasons.push("BEST_VALUE");
  if (candidate.personalFit.brandPreferenceMatched)
    reasons.push("PREFERRED_BRAND");
  if (candidate.commercialFit.budgetFit === "WITHIN_BUDGET")
    reasons.push("WITHIN_BUDGET");
  if (candidate.commercialFit.budgetFit === "SLIGHTLY_ABOVE")
    reasons.push("SLIGHTLY_ABOVE_BUDGET");
  if (
    candidate.unit.condition?.toLowerCase() === "used" &&
    candidate.commercialFit.valueClass !== "WEAK"
  )
    reasons.push("USED_VALUE_OPTION");
  if (candidate.equipmentMatch.confidence === "LOW")
    reasons.push("LOWER_CONFIDENCE");
  if (candidate.unit.stock !== null && candidate.unit.stock <= 3)
    reasons.push("LIMITED_AVAILABILITY");
  return reasons;
}

function output(
  candidate: Evaluated,
  rank: number,
  role: RecommendationRole,
  highestTechnicalScore: number,
): RankedRecommendationCandidate {
  return {
    candidate: candidate.unit,
    equipmentMatch: candidate.equipmentMatch,
    personalFit: candidate.personalFit,
    commercialFit: candidate.commercialFit,
    rank,
    role,
    safeReasons: reasonsFor(candidate, role, highestTechnicalScore),
  };
}

export function matchInventoryCandidates(
  input: MatchInventoryInput,
): InventoryCandidate[] {
  return input.units.map((unit) => {
    const matchInput: EquipmentMatchInput = {
      golfer: input.golfer,
      currentEquipment: input.currentEquipment,
      objectives: input.objectives,
      measurements: input.measurements,
      equipmentUnit: {
        id: unit.unitId,
        category: unit.category,
        brand: unit.brand,
        model: unit.model,
        canonicalModelId: unit.canonicalModelId,
        condition: unit.condition,
        source: "EXTERNAL_SOURCE",
        confidence: "HIGH",
        specifications: unit.technicalSpecs,
      },
    };
    return { unit, equipmentMatch: matchEquipment(matchInput) };
  });
}

export function rankInventoryCandidates(
  candidates: RankableInventoryCandidate[],
  preferences: RankingPreferences = {},
): CommercialRankingResult {
  if (candidates.length === 0) return noCurrentMatch("EMPTY_INVENTORY");
  const unique = new Map<string, RankableInventoryCandidate>();
  for (const candidate of [...candidates].sort((a, b) =>
    `${a.unit.productId}:${a.unit.unitId}`.localeCompare(
      `${b.unit.productId}:${b.unit.unitId}`,
      "en",
    ),
  )) {
    if (!unique.has(candidate.unit.productId))
      unique.set(candidate.unit.productId, candidate);
  }
  const available = [...unique.values()].filter(({ unit }) => {
    if (
      unit.availability !== "AVAILABLE" ||
      unit.stock === null ||
      unit.stock <= 0 ||
      unit.priceMxnMinor === null
    )
      return false;
    if (
      preferences.conditionPreference === "NEW_ONLY" &&
      normalize(unit.condition) !== "new"
    )
      return false;
    return true;
  });
  if (available.length === 0) return noCurrentMatch("NO_AVAILABLE_UNITS");
  const responsible = available.filter(
    ({ equipmentMatch }) =>
      equipmentMatch.status === "MATCH" &&
      equipmentMatch.matchScore >= RESPONSIBLE_MATCH_FLOOR,
  );
  if (responsible.length === 0)
    return noCurrentMatch("NO_TECHNICALLY_RESPONSIBLE_UNIT");

  const ordered = responsibleOrder(evaluate(responsible, preferences));
  const best = ordered[0];
  const highestTechnicalScore = Math.max(
    ...responsible.map(({ equipmentMatch }) => equipmentMatch.matchScore),
  );
  const recommendations: RankedRecommendationCandidate[] = [
    output(best, 1, "BEST_OPTION", highestTechnicalScore),
  ];
  const bestValue = ordered.find((candidate) => {
    if (
      candidate === best ||
      candidate.equipmentMatch.matchScore < BEST_VALUE_MATCH_FLOOR
    )
      return false;
    const price = candidate.unit.priceMxnMinor;
    const bestPrice = best.unit.priceMxnMinor;
    return (
      price !== null &&
      bestPrice !== null &&
      price * 100 <= bestPrice * (100 - MEANINGFULLY_CHEAPER_PERCENT)
    );
  });
  if (bestValue)
    recommendations.push(
      output(
        bestValue,
        recommendations.length + 1,
        "BEST_VALUE",
        highestTechnicalScore,
      ),
    );
  const used = new Set(
    recommendations.map(({ candidate }) => candidate.unitId),
  );
  const alternative = ordered.find(
    (candidate) => !used.has(candidate.unit.unitId),
  );
  if (alternative)
    recommendations.push(
      output(
        alternative,
        recommendations.length + 1,
        "ALTERNATIVE",
        highestTechnicalScore,
      ),
    );
  return {
    status: "RECOMMENDATIONS",
    ruleVersion: COMMERCIAL_RANKING_VERSION,
    recommendations: recommendations.slice(0, 3),
    noMatch: null,
  };
}

function noCurrentMatch(
  reason: NonNullable<CommercialRankingResult["noMatch"]>["reason"],
): CommercialRankingResult {
  return {
    status: "NO_CURRENT_MATCH",
    ruleVersion: COMMERCIAL_RANKING_VERSION,
    recommendations: [],
    noMatch: {
      reason,
      responsibleMatchFloor: RESPONSIBLE_MATCH_FLOOR,
      futureAlertMatchFloor: FUTURE_ALERT_MATCH_FLOOR,
    },
  };
}
