import { CATEGORY_MATCH_PROFILES } from "@/lib/matching/category-match-profiles";
import {
  nextBestQuestion,
  type EquipmentMatch,
  type EquipmentMatchComponent,
  type EquipmentMatchInput,
  type EquipmentMatchReason,
  type EquipmentUnitSpecifications,
  type MatchCategory,
  type MatchConfidence,
  type MemoryConfidence,
  type MemorySource,
  type MiGolfEquipment,
  type MissingMatchData,
} from "@/lib/mi-golf/domain";

type PlayerLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null;
type ReasonSeverity = EquipmentMatchReason["severity"];

const SOURCE_QUALITY: Readonly<Record<MemorySource, number>> = {
  MEASURED: 3,
  USER_DECLARED: 3,
  EXTERNAL_SOURCE: 2,
  PURCHASE_HISTORY: 1,
  SYSTEM_INFERRED: 1,
  FUTURE_VIDEO: 1,
};
const CONFIDENCE_QUALITY: Readonly<Record<MemoryConfidence, number>> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export function normalizeMatchCategory(category: string): MatchCategory {
  const value = category
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (value === "driver") return "DRIVER";
  if (
    ["fairway", "fairway_wood", "fairway_woods", "wood", "woods"].includes(
      value,
    )
  )
    return "FAIRWAY_WOOD";
  if (["hybrid", "hybrids"].includes(value)) return "HYBRID";
  if (["iron", "irons", "iron_set"].includes(value)) return "IRON";
  if (["wedge", "wedges"].includes(value)) return "WEDGE";
  if (["putter", "putters"].includes(value)) return "PUTTER";
  throw new RangeError(`Unsupported equipment match category: ${category}`);
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.trunc(score)));
}

function normalized(value: unknown): string {
  return typeof value === "string"
    ? value
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, "_")
    : "";
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function profileHand(input: EquipmentMatchInput) {
  const hand = normalized(input.golfer?.handedness);
  return hand === "RIGHT" || hand === "LEFT" ? hand : null;
}

function unitHand(specifications: EquipmentUnitSpecifications) {
  const hand = normalized(specifications.handedness);
  return hand === "RIGHT" || hand === "LEFT" ? hand : null;
}

function playerLevel(input: EquipmentMatchInput): PlayerLevel {
  const handicap = input.golfer?.handicap;
  if (typeof handicap === "number") {
    if (handicap >= 25) return "BEGINNER";
    if (handicap <= 10) return "ADVANCED";
    return "INTERMEDIATE";
  }
  const skill = normalized(input.golfer?.skillLevel);
  if (["BEGINNER", "BEGINNER_GOLFER", "PRINCIPIANTE", "NOVATO"].includes(skill))
    return "BEGINNER";
  if (["ADVANCED", "EXPERT", "AVANZADO", "TOUR"].includes(skill))
    return "ADVANCED";
  if (skill) return "INTERMEDIATE";
  return null;
}

function activeObjectiveText(input: EquipmentMatchInput) {
  return input.objectives
    .filter((objective) => objective.status === "ACTIVE")
    .map((objective) =>
      `${objective.objectiveType} ${objective.details ?? ""}`.toLowerCase(),
    )
    .join(" ");
}

function objectiveIncludes(input: EquipmentMatchInput, tokens: string[]) {
  const text = activeObjectiveText(input);
  return tokens.some((token) => text.includes(token));
}

function hasLongIronReplacementObjective(input: EquipmentMatchInput) {
  const text = activeObjectiveText(input);
  const namesIron = text.includes("iron") || text.includes("hierro");
  const namesReplacement =
    text.includes("replace") || text.includes("reemplaz");
  return namesIron && namesReplacement;
}

function currentEquipmentFor(
  input: EquipmentMatchInput,
  categories: MatchCategory[],
) {
  return input.currentEquipment.filter((equipment) => {
    if (!equipment.isActive) return false;
    try {
      return categories.includes(normalizeMatchCategory(equipment.category));
    } catch {
      return false;
    }
  });
}

function equipmentSpecNumber(equipment: MiGolfEquipment, key: string) {
  return numberValue(equipment.specifications[key]);
}

function makeAccumulator(baseScore: number) {
  let score = baseScore;
  const reasons: EquipmentMatchReason[] = [];
  return {
    add(
      code: string,
      severity: ReasonSeverity,
      component: EquipmentMatchComponent,
      impact: number,
    ) {
      const integerImpact = Math.trunc(impact);
      score += integerImpact;
      reasons.push({ code, severity, component, scoreImpact: integerImpact });
    },
    result() {
      return { score: clampScore(score), reasons };
    },
  };
}

function addPlayerProfileRules(
  input: EquipmentMatchInput,
  add: ReturnType<typeof makeAccumulator>["add"],
  weight: number,
) {
  const level = playerLevel(input);
  const forgiveness = input.equipmentUnit.specifications.forgiveness;
  const unitProfile = input.equipmentUnit.specifications.playerProfile;
  if (!level || (!forgiveness && !unitProfile)) return;
  if (level === "BEGINNER") {
    if (
      forgiveness === "HIGH" ||
      ["BEGINNER", "IMPROVING"].includes(unitProfile ?? "")
    )
      add(
        "FORGIVENESS_SUPPORTS_PLAYER",
        "POSITIVE",
        "PLAYER_LEVEL",
        Math.ceil(weight / 2),
      );
    if (
      forgiveness === "LOW" ||
      ["ADVANCED", "TOUR"].includes(unitProfile ?? "")
    )
      add("DEMANDING_PROFILE_FOR_PLAYER", "TRADEOFF", "PLAYER_LEVEL", -weight);
  } else if (level === "ADVANCED") {
    if (["ADVANCED", "TOUR"].includes(unitProfile ?? ""))
      add(
        "PLAYER_PROFILE_ALIGNED",
        "POSITIVE",
        "PLAYER_LEVEL",
        Math.ceil(weight / 2),
      );
    else if (unitProfile === "BEGINNER")
      add(
        "PLAYER_PROFILE_COMPROMISE",
        "TRADEOFF",
        "PLAYER_LEVEL",
        -Math.ceil(weight / 2),
      );
  } else if (["IMPROVING", "INTERMEDIATE"].includes(unitProfile ?? "")) {
    add(
      "PLAYER_PROFILE_ALIGNED",
      "POSITIVE",
      "PLAYER_LEVEL",
      Math.ceil(weight / 3),
    );
  }
}

function expectedShaftFlex(swingSpeedMph: number): string[] {
  if (swingSpeedMph < 75) return ["LADIES", "SENIOR"];
  if (swingSpeedMph < 95) return ["REGULAR"];
  if (swingSpeedMph < 110) return ["STIFF"];
  return ["X_STIFF", "XSTIFF"];
}

function addShaftRules(
  input: EquipmentMatchInput,
  add: ReturnType<typeof makeAccumulator>["add"],
  weight: number,
) {
  const speed = input.measurements?.swingSpeedMph?.value;
  const flex = normalized(input.equipmentUnit.specifications.shaftFlex);
  if (typeof speed !== "number" || !Number.isFinite(speed) || !flex) return;
  if (expectedShaftFlex(speed).includes(flex))
    add("SHAFT_FLEX_ALIGNED", "POSITIVE", "SHAFT", Math.ceil(weight / 2));
  else add("SHAFT_FLEX_MISMATCH", "TRADEOFF", "SHAFT", -weight);

  const material = normalized(input.equipmentUnit.specifications.shaftMaterial);
  const shaftWeight = numberValue(
    input.equipmentUnit.specifications.shaftWeightGrams,
  );
  if (speed < 80 && material === "GRAPHITE")
    add("SHAFT_MATERIAL_SUPPORTS_SPEED", "POSITIVE", "SHAFT", 2);
  if (shaftWeight !== null && speed < 80) {
    if (shaftWeight <= 65)
      add("SHAFT_WEIGHT_SUPPORTS_SPEED", "POSITIVE", "SHAFT", 2);
    else if (shaftWeight >= 80)
      add("SHAFT_WEIGHT_TRADEOFF", "TRADEOFF", "SHAFT", -3);
  }
  if (shaftWeight !== null && speed >= 100) {
    if (shaftWeight >= 60)
      add("SHAFT_WEIGHT_SUPPORTS_SPEED", "POSITIVE", "SHAFT", 2);
    else if (shaftWeight < 50)
      add("SHAFT_WEIGHT_TRADEOFF", "TRADEOFF", "SHAFT", -3);
  }
}

function addExplicitShotBiasRules(
  input: EquipmentMatchInput,
  add: ReturnType<typeof makeAccumulator>["add"],
  weight: number,
) {
  const tendency = normalized(input.golfer?.shotTendency);
  const specs = input.equipmentUnit.specifications;
  if (tendency.includes("SLICE") && specs.drawBias === true)
    add(
      "EXPLICIT_DRAW_BIAS_SUPPORTS_SLICE",
      "POSITIVE",
      "SHOT_TENDENCY",
      weight,
    );
  if (tendency.includes("HOOK") && specs.drawBias === true)
    add("DRAW_BIAS_CONFLICTS_WITH_HOOK", "TRADEOFF", "SHOT_TENDENCY", -weight);
}

function lofts(equipment: MiGolfEquipment[]) {
  return equipment
    .map((item) => equipmentSpecNumber(item, "loftDegrees"))
    .filter((loft): loft is number => loft !== null)
    .sort((a, b) => a - b);
}

function addGapRules(
  candidateLoft: number | null,
  currentLofts: number[],
  add: ReturnType<typeof makeAccumulator>["add"],
  weight: number,
) {
  if (candidateLoft === null || currentLofts.length === 0) return;
  if (currentLofts.some((loft) => Math.abs(loft - candidateLoft) <= 2)) {
    add("BAG_LOFT_REDUNDANCY", "TRADEOFF", "BAG_GAP", -weight);
    return;
  }
  for (let index = 1; index < currentLofts.length; index += 1) {
    const low = currentLofts[index - 1];
    const high = currentLofts[index];
    if (
      high - low >= 8 &&
      candidateLoft > low + 2 &&
      candidateLoft < high - 2
    ) {
      add("BAG_LOFT_GAP_FILLED", "POSITIVE", "BAG_GAP", Math.ceil(weight / 2));
      return;
    }
  }
}

function addDriverRules(
  input: EquipmentMatchInput,
  add: ReturnType<typeof makeAccumulator>["add"],
) {
  const profile = CATEGORY_MATCH_PROFILES.DRIVER;
  const specs = input.equipmentUnit.specifications;
  const level = playerLevel(input);
  addPlayerProfileRules(input, add, profile.weights.PLAYER_LEVEL);
  addShaftRules(input, add, profile.weights.SHAFT);
  const loft = numberValue(specs.loftDegrees);
  if (loft !== null && level === "BEGINNER") {
    if (loft >= 10) add("DRIVER_LOFT_SUPPORTS_LAUNCH", "POSITIVE", "LOFT", 4);
    else if (loft <= 9)
      add(
        "DRIVER_LOW_LOFT_TRADEOFF",
        "TRADEOFF",
        "LOFT",
        -profile.weights.LOFT,
      );
  }
  const tendency = normalized(input.golfer?.shotTendency);
  addExplicitShotBiasRules(input, add, profile.weights.SHOT_TENDENCY);
  if (
    (tendency.includes("SLICE") || tendency.includes("HOOK")) &&
    (specs.adjustableHosel || specs.adjustableLoft)
  )
    add("ADJUSTABILITY_SUPPORTS_TUNING", "POSITIVE", "CONFIGURATION", 3);
  if (
    objectiveIncludes(input, [
      "forgiveness",
      "perdón",
      "perdon",
      "consistencia",
    ]) &&
    specs.forgiveness === "HIGH"
  )
    add("FORGIVENESS_OBJECTIVE_ALIGNED", "POSITIVE", "CONFIGURATION", 4);
  const currentDrivers = currentEquipmentFor(input, ["DRIVER"]);
  if (
    loft !== null &&
    currentDrivers.some((item) => {
      const currentLoft = equipmentSpecNumber(item, "loftDegrees");
      return currentLoft !== null && Math.abs(currentLoft - loft) <= 1;
    }) &&
    !objectiveIncludes(input, [
      "slice",
      "hook",
      "forgiveness",
      "perdón",
      "perdon",
      "distance",
      "distancia",
    ])
  )
    add("CURRENT_DRIVER_CONFIGURATION_SIMILAR", "NEUTRAL", "BAG_GAP", 0);
}

function addFairwayRules(
  input: EquipmentMatchInput,
  add: ReturnType<typeof makeAccumulator>["add"],
) {
  const profile = CATEGORY_MATCH_PROFILES.FAIRWAY_WOOD;
  addPlayerProfileRules(input, add, profile.weights.PLAYER_LEVEL);
  addShaftRules(input, add, profile.weights.SHAFT);
  addExplicitShotBiasRules(input, add, profile.weights.SHOT_TENDENCY);
  addGapRules(
    numberValue(input.equipmentUnit.specifications.loftDegrees),
    lofts(currentEquipmentFor(input, ["FAIRWAY_WOOD", "HYBRID"])),
    add,
    profile.weights.BAG_GAP,
  );
  if (
    playerLevel(input) === "BEGINNER" &&
    input.equipmentUnit.specifications.forgiveness === "HIGH"
  )
    add("FAIRWAY_EASE_OF_USE_EXPLICIT", "POSITIVE", "CONFIGURATION", 4);
}

function addHybridRules(
  input: EquipmentMatchInput,
  add: ReturnType<typeof makeAccumulator>["add"],
) {
  const profile = CATEGORY_MATCH_PROFILES.HYBRID;
  addPlayerProfileRules(input, add, profile.weights.PLAYER_LEVEL);
  addShaftRules(input, add, profile.weights.SHAFT);
  addGapRules(
    numberValue(input.equipmentUnit.specifications.loftDegrees),
    lofts(currentEquipmentFor(input, ["FAIRWAY_WOOD", "HYBRID", "IRON"])),
    add,
    profile.weights.BAG_GAP,
  );
  const replacementObjective = hasLongIronReplacementObjective(input);
  if (replacementObjective)
    add(
      "LONG_IRON_REPLACEMENT_OBJECTIVE",
      "POSITIVE",
      "CONFIGURATION",
      profile.weights.CONFIGURATION,
    );
}

function addIronRules(
  input: EquipmentMatchInput,
  add: ReturnType<typeof makeAccumulator>["add"],
) {
  const profile = CATEGORY_MATCH_PROFILES.IRON;
  addPlayerProfileRules(input, add, profile.weights.PLAYER_LEVEL);
  addShaftRules(input, add, profile.weights.SHAFT);
  const makeup = input.equipmentUnit.specifications.setMakeup ?? [];
  if (
    playerLevel(input) === "BEGINNER" &&
    makeup.some((club) =>
      ["2", "3", "4", "2I", "3I", "4I"].includes(normalized(club)),
    )
  )
    add("LONG_IRON_SET_COMPOSITION_TRADEOFF", "TRADEOFF", "CONFIGURATION", -5);
  if (
    objectiveIncludes(input, [
      "forgiveness",
      "perdón",
      "perdon",
      "consistency",
      "consistencia",
    ]) &&
    input.equipmentUnit.specifications.forgiveness === "HIGH"
  )
    add("IRON_FORGIVENESS_OBJECTIVE_ALIGNED", "POSITIVE", "CONFIGURATION", 5);
  if (
    !input.measurements?.lieFitKnown?.value ||
    !input.measurements?.lengthFitKnown?.value
  )
    add("IRON_PRO_FITTING_RECOMMENDED", "WARNING", "CONFIGURATION", 0);
}

function addWedgeRules(
  input: EquipmentMatchInput,
  add: ReturnType<typeof makeAccumulator>["add"],
) {
  const profile = CATEGORY_MATCH_PROFILES.WEDGE;
  const specs = input.equipmentUnit.specifications;
  addPlayerProfileRules(input, add, profile.weights.PLAYER_LEVEL);
  addGapRules(
    numberValue(specs.loftDegrees),
    lofts(currentEquipmentFor(input, ["WEDGE"])),
    add,
    profile.weights.BAG_GAP,
  );
  const candidateLoft = numberValue(specs.loftDegrees);
  const currentWedgeLofts = lofts(currentEquipmentFor(input, ["WEDGE"]));
  if (candidateLoft !== null && currentWedgeLofts.length >= 2) {
    const highest = currentWedgeLofts[currentWedgeLofts.length - 1];
    const previous = currentWedgeLofts[currentWedgeLofts.length - 2];
    const currentGap = highest - previous;
    const candidateGap = candidateLoft - highest;
    if (
      currentGap >= 4 &&
      currentGap <= 8 &&
      candidateGap >= 4 &&
      candidateGap <= 8 &&
      Math.abs(currentGap - candidateGap) <= 2
    )
      add(
        "WEDGE_LOFT_PROGRESSION_ALIGNED",
        "POSITIVE",
        "BAG_GAP",
        Math.ceil(profile.weights.BAG_GAP / 2),
      );
  }
  const bounce = numberValue(specs.bounceDegrees);
  const turf = input.measurements?.turfInteraction?.value;
  if (bounce !== null && turf === "STEEP") {
    if (bounce >= 10)
      add(
        "WEDGE_BOUNCE_SUPPORTS_STEEP_DELIVERY",
        "POSITIVE",
        "CONFIGURATION",
        6,
      );
    else if (bounce <= 6)
      add("WEDGE_LOW_BOUNCE_STEEP_TRADEOFF", "TRADEOFF", "CONFIGURATION", -7);
  }
  if (bounce !== null && turf === "SHALLOW") {
    if (bounce <= 8)
      add(
        "WEDGE_BOUNCE_SUPPORTS_SHALLOW_DELIVERY",
        "POSITIVE",
        "CONFIGURATION",
        5,
      );
    else if (bounce >= 12)
      add(
        "WEDGE_HIGH_BOUNCE_SHALLOW_TRADEOFF",
        "TRADEOFF",
        "CONFIGURATION",
        -5,
      );
  }
  const conditions = input.measurements?.playingConditions?.value;
  if (bounce !== null && conditions === "SOFT") {
    if (bounce >= 10)
      add("WEDGE_BOUNCE_SUPPORTS_SOFT_TURF", "POSITIVE", "CONFIGURATION", 2);
    else if (bounce <= 6)
      add("WEDGE_LOW_BOUNCE_SOFT_TURF", "TRADEOFF", "CONFIGURATION", -3);
  }
  if (bounce !== null && conditions === "FIRM") {
    if (bounce <= 8)
      add("WEDGE_BOUNCE_SUPPORTS_FIRM_TURF", "POSITIVE", "CONFIGURATION", 2);
    else if (bounce >= 12)
      add("WEDGE_HIGH_BOUNCE_FIRM_TURF", "TRADEOFF", "CONFIGURATION", -3);
  }
  if ((bounce !== null || specs.grind) && !turf)
    add("WEDGE_PRO_FITTING_CONTEXT_REQUIRED", "WARNING", "CONFIGURATION", 0);
}

function addPutterRules(
  input: EquipmentMatchInput,
  add: ReturnType<typeof makeAccumulator>["add"],
) {
  const specs = input.equipmentUnit.specifications;
  if (specs.putterHeadType)
    add("PUTTER_HEAD_TYPE_KNOWN", "NEUTRAL", "CONFIGURATION", 0);
  const stroke = input.measurements?.strokeType?.value;
  const strokeFit = normalized(specs.strokeFit);
  if (stroke && strokeFit) {
    if (stroke === strokeFit)
      add("PUTTER_STROKE_PROFILE_ALIGNED", "POSITIVE", "CONFIGURATION", 7);
    else add("PUTTER_STROKE_PROFILE_TRADEOFF", "TRADEOFF", "CONFIGURATION", -7);
  }
  const currentLength = input.measurements?.putterLengthInches?.value;
  const unitLength = numberValue(specs.lengthInches);
  if (typeof currentLength === "number" && unitLength !== null) {
    const difference = Math.abs(currentLength - unitLength);
    if (difference <= 1)
      add("PUTTER_LENGTH_CONTEXT_ALIGNED", "POSITIVE", "CONFIGURATION", 5);
    else if (difference > 2)
      add("PUTTER_LENGTH_REQUIRES_VALIDATION", "TRADEOFF", "CONFIGURATION", -7);
  }
  if (!stroke || unitLength === null)
    add("PUTTER_PRO_FITTING_RECOMMENDED", "WARNING", "CONFIGURATION", 0);
}

function missingData(
  input: EquipmentMatchInput,
  category: MatchCategory,
): MissingMatchData[] {
  const missing: MissingMatchData[] = [];
  const add = (
    field: string,
    code: string,
    importance: MissingMatchData["importance"],
  ) => {
    if (!missing.some((item) => item.field === field))
      missing.push({ field, code, importance });
  };
  if (!profileHand(input))
    add("golfer.handedness", "GOLFER_HANDEDNESS_MISSING", "CRITICAL");
  if (!unitHand(input.equipmentUnit.specifications))
    add(
      "equipmentUnit.specifications.handedness",
      "UNIT_HANDEDNESS_MISSING",
      "CRITICAL",
    );
  if (
    !playerLevel(input) &&
    ["DRIVER", "FAIRWAY_WOOD", "HYBRID", "IRON"].includes(category)
  )
    add("golfer.skillLevel", "PLAYER_LEVEL_MISSING", "MATERIAL");
  if (
    !input.equipmentUnit.specifications.shaftFlex &&
    category !== "WEDGE" &&
    category !== "PUTTER"
  )
    add(
      "equipmentUnit.specifications.shaftFlex",
      "UNIT_SHAFT_FLEX_MISSING",
      "MATERIAL",
    );
  if (
    !input.measurements?.swingSpeedMph &&
    ["DRIVER", "FAIRWAY_WOOD", "HYBRID", "IRON"].includes(category)
  )
    add("measurements.swingSpeedMph", "SWING_SPEED_MISSING", "HELPFUL");
  if (category === "DRIVER") {
    if (!input.objectives.some((objective) => objective.status === "ACTIVE"))
      add("objectives.active", "ACTIVE_OBJECTIVE_MISSING", "HELPFUL");
    if (!input.golfer?.shotTendency)
      add("golfer.shotTendency", "SHOT_TENDENCY_MISSING", "MATERIAL");
    if (numberValue(input.equipmentUnit.specifications.loftDegrees) === null)
      add(
        "equipmentUnit.specifications.loftDegrees",
        "DRIVER_LOFT_MISSING",
        "MATERIAL",
      );
  }
  if (category === "FAIRWAY_WOOD" || category === "HYBRID") {
    if (numberValue(input.equipmentUnit.specifications.loftDegrees) === null)
      add(
        "equipmentUnit.specifications.loftDegrees",
        "CLUB_LOFT_MISSING",
        "MATERIAL",
      );
    if (
      currentEquipmentFor(input, ["FAIRWAY_WOOD", "HYBRID", "IRON"]).length ===
      0
    )
      add("currentEquipment", "BAG_GAP_CONTEXT_MISSING", "MATERIAL");
  }
  if (category === "IRON") {
    if (!input.equipmentUnit.specifications.setMakeup?.length)
      add(
        "equipmentUnit.specifications.setMakeup",
        "IRON_SET_MAKEUP_MISSING",
        "MATERIAL",
      );
    if (!input.measurements?.lieFitKnown?.value)
      add("measurements.lieFitKnown", "IRON_LIE_FIT_UNCONFIRMED", "MATERIAL");
    if (!input.measurements?.lengthFitKnown?.value)
      add(
        "measurements.lengthFitKnown",
        "IRON_LENGTH_FIT_UNCONFIRMED",
        "MATERIAL",
      );
  }
  if (category === "WEDGE") {
    if (numberValue(input.equipmentUnit.specifications.loftDegrees) === null)
      add(
        "equipmentUnit.specifications.loftDegrees",
        "WEDGE_LOFT_MISSING",
        "MATERIAL",
      );
    if (currentEquipmentFor(input, ["WEDGE"]).length === 0)
      add("currentEquipment.wedgeLofts", "WEDGE_GAPPING_MISSING", "MATERIAL");
    if (numberValue(input.equipmentUnit.specifications.bounceDegrees) === null)
      add(
        "equipmentUnit.specifications.bounceDegrees",
        "WEDGE_BOUNCE_MISSING",
        "HELPFUL",
      );
    if (!input.equipmentUnit.specifications.grind)
      add(
        "equipmentUnit.specifications.grind",
        "WEDGE_GRIND_MISSING",
        "HELPFUL",
      );
    if (!input.measurements?.turfInteraction)
      add(
        "measurements.turfInteraction",
        "TURF_INTERACTION_MISSING",
        "MATERIAL",
      );
  }
  if (category === "PUTTER") {
    if (!input.equipmentUnit.specifications.putterHeadType)
      add(
        "equipmentUnit.specifications.putterHeadType",
        "PUTTER_HEAD_TYPE_MISSING",
        "HELPFUL",
      );
    if (numberValue(input.equipmentUnit.specifications.lengthInches) === null)
      add(
        "equipmentUnit.specifications.lengthInches",
        "PUTTER_LENGTH_MISSING",
        "MATERIAL",
      );
    if (!input.measurements?.strokeType)
      add("measurements.strokeType", "PUTTER_STROKE_MISSING", "MATERIAL");
  }
  return missing;
}

function evidenceQuality(source: MemorySource, confidence: MemoryConfidence) {
  return SOURCE_QUALITY[source] + CONFIDENCE_QUALITY[confidence];
}

function matchConfidence(
  input: EquipmentMatchInput,
  missing: MissingMatchData[],
): MatchConfidence {
  if (missing.some((item) => item.importance === "CRITICAL")) return "LOW";
  const materialMissing = missing.filter(
    (item) => item.importance === "MATERIAL",
  ).length;
  const golferQuality = input.golfer
    ? evidenceQuality(input.golfer.source, input.golfer.confidence)
    : 0;
  const unitQuality = evidenceQuality(
    input.equipmentUnit.source,
    input.equipmentUnit.confidence,
  );
  const measuredQuality = Object.values(input.measurements ?? {})
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .reduce(
      (total, item) => total + evidenceQuality(item.source, item.confidence),
      0,
    );
  const contextEvidence = [
    ...input.objectives.filter((objective) => objective.status === "ACTIVE"),
    ...input.currentEquipment.filter((equipment) => equipment.isActive),
  ];
  const contextQuality = contextEvidence.reduce(
    (total, item) => total + evidenceQuality(item.source, item.confidence),
    0,
  );
  const evidenceCount =
    2 +
    Object.values(input.measurements ?? {}).filter(Boolean).length +
    contextEvidence.length;
  const averageQuality = Math.trunc(
    (golferQuality + unitQuality + measuredQuality + contextQuality) /
      evidenceCount,
  );
  if (materialMissing === 0 && averageQuality >= 5) return "HIGH";
  if (materialMissing <= 2 && averageQuality >= 3) return "MEDIUM";
  return "LOW";
}

function knownQuestionContext(input: EquipmentMatchInput) {
  return {
    handedness: profileHand(input),
    objective: input.objectives.some(
      (objective) => objective.status === "ACTIVE",
    ),
    shotTendency: input.golfer?.shotTendency,
    swingSpeed: input.measurements?.swingSpeedMph?.value,
    currentBag: input.currentEquipment.some((equipment) => equipment.isActive),
    skill: playerLevel(input),
    gapping: currentEquipmentFor(input, ["WEDGE"]).some(
      (equipment) => equipmentSpecNumber(equipment, "loftDegrees") !== null,
    ),
    turfInteraction: input.measurements?.turfInteraction?.value,
    length: input.measurements?.putterLengthInches?.value,
    strokeType: input.measurements?.strokeType?.value,
  };
}

export function matchEquipment(input: EquipmentMatchInput): EquipmentMatch {
  const category = normalizeMatchCategory(input.equipmentUnit.category);
  const profile = CATEGORY_MATCH_PROFILES[category];
  const missing = missingData(input, category);
  const accumulator = makeAccumulator(profile.baseScore);
  const golferHand = profileHand(input);
  const equipmentHand = unitHand(input.equipmentUnit.specifications);
  if (golferHand && equipmentHand && golferHand !== equipmentHand) {
    const incompatibility: EquipmentMatchReason = {
      code: "HANDEDNESS_MISMATCH",
      severity: "INCOMPATIBILITY",
      component: "HANDEDNESS",
      scoreImpact: -100,
    };
    return {
      status: "INCOMPATIBLE",
      matchScore: 0,
      confidence: matchConfidence(input, missing),
      category,
      ruleVersion: profile.ruleVersion,
      reasons: [incompatibility],
      tradeoffs: [],
      missingData: missing,
      nextBestQuestion: nextBestQuestion(category, knownQuestionContext(input)),
    };
  }
  if (golferHand && equipmentHand)
    accumulator.add("HANDEDNESS_COMPATIBLE", "POSITIVE", "HANDEDNESS", 0);

  if (category === "DRIVER") addDriverRules(input, accumulator.add);
  if (category === "FAIRWAY_WOOD") addFairwayRules(input, accumulator.add);
  if (category === "HYBRID") addHybridRules(input, accumulator.add);
  if (category === "IRON") addIronRules(input, accumulator.add);
  if (category === "WEDGE") addWedgeRules(input, accumulator.add);
  if (category === "PUTTER") addPutterRules(input, accumulator.add);

  const result = accumulator.result();
  return {
    status: "MATCH",
    matchScore: result.score,
    confidence: matchConfidence(input, missing),
    category,
    ruleVersion: profile.ruleVersion,
    reasons: result.reasons,
    tradeoffs: result.reasons.filter(
      (reason) =>
        reason.severity === "TRADEOFF" || reason.severity === "WARNING",
    ),
    missingData: missing,
    nextBestQuestion: nextBestQuestion(category, knownQuestionContext(input)),
  };
}

export function matchEquipmentUnits(
  inputs: EquipmentMatchInput[],
): EquipmentMatch[] {
  return inputs.map(matchEquipment);
}
