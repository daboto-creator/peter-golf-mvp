export const MEMORY_SOURCES = [
  "USER_DECLARED",
  "PURCHASE_HISTORY",
  "SYSTEM_INFERRED",
  "MEASURED",
  "EXTERNAL_SOURCE",
  "FUTURE_VIDEO",
] as const;
export type MemorySource = (typeof MEMORY_SOURCES)[number];
export type MemoryConfidence = "HIGH" | "MEDIUM" | "LOW";

export type MiGolfProfile = {
  userId: string;
  handicap: number | null;
  handedness: "RIGHT" | "LEFT" | "UNKNOWN" | null;
  skillLevel: string | null;
  playFrequency: string | null;
  shotTendency: string | null;
  preferences: Record<string, unknown>;
  source: MemorySource;
  confidence: MemoryConfidence;
};

export type MiGolfEquipment = {
  id: string;
  userId: string;
  category: string;
  brand: string | null;
  model: string | null;
  specifications: Record<string, unknown>;
  source: MemorySource;
  confidence: MemoryConfidence;
  notes: string | null;
  isActive: boolean;
};

export type MiGolfObjective = {
  id: string;
  userId: string;
  objectiveType: string;
  status: "ACTIVE" | "ACHIEVED" | "NO_LONGER_PRIORITY";
  details: string | null;
  source: MemorySource;
  confidence: MemoryConfidence;
};

export type BuyingIntent =
  "BUY_NOW" | "ACTIVE_RESEARCH" | "EXPLORING" | "UNKNOWN";
export type BestRoundProSessionSummary = {
  requestedCategory: string | null;
  purchaseIntent: BuyingIntent;
  budgetMxnMinor: number | null;
  objections: string[];
  productsConsidered: string[];
  diagnosticAnswers: Record<string, string | number | boolean | null>;
  unresolvedQuestions: string[];
  summary: string | null;
};

export type NextBestQuestion = {
  id: string;
  prompt: string;
  category: string;
  reason: string;
  critical: boolean;
  slotType:
    | "CATEGORY"
    | "HANDEDNESS"
    | "HANDICAP"
    | "SWING_SPEED"
    | "SHOT_TENDENCY"
    | "DISTANCE_GAP"
    | "CURRENT_EQUIPMENT"
    | "CONDITION_PREFERENCE"
    | "OBJECTIVE"
    | "PUTTER_LENGTH"
    | "WEDGE_CONTEXT"
    | "BOOLEAN_PREFERENCE";
  valueType: "TEXT" | "NUMBER" | "ENUM" | "BOOLEAN" | "EQUIPMENT_LIST";
  unitContext: string | null;
  interpretationScope: "ANSWER" | "TARGET_SELECTION";
};

type RawNextBestQuestion = Omit<
  NextBestQuestion,
  "slotType" | "valueType" | "unitContext" | "interpretationScope"
>;

function nextQuestionSlot(id: string) {
  const slots: Record<
    string,
    Pick<
      NextBestQuestion,
      "slotType" | "valueType" | "unitContext" | "interpretationScope"
    >
  > = {
    handedness: {
      slotType: "HANDEDNESS",
      valueType: "ENUM",
      unitContext: null,
      interpretationScope: "ANSWER",
    },
    objective: {
      slotType: "OBJECTIVE",
      valueType: "ENUM",
      unitContext: null,
      interpretationScope: "ANSWER",
    },
    shotTendency: {
      slotType: "SHOT_TENDENCY",
      valueType: "ENUM",
      unitContext: null,
      interpretationScope: "ANSWER",
    },
    swingSpeed: {
      slotType: "SWING_SPEED",
      valueType: "NUMBER",
      unitContext: "MPH",
      interpretationScope: "ANSWER",
    },
    currentBag: {
      slotType: "CURRENT_EQUIPMENT",
      valueType: "EQUIPMENT_LIST",
      unitContext: null,
      interpretationScope: "ANSWER",
    },
    skill: {
      slotType: "HANDICAP",
      valueType: "NUMBER",
      unitContext: null,
      interpretationScope: "ANSWER",
    },
    gapping: {
      slotType: "DISTANCE_GAP",
      valueType: "NUMBER",
      unitContext: "GOLF_DISTANCE",
      interpretationScope: "ANSWER",
    },
    turfInteraction: {
      slotType: "WEDGE_CONTEXT",
      valueType: "ENUM",
      unitContext: null,
      interpretationScope: "ANSWER",
    },
    length: {
      slotType: "PUTTER_LENGTH",
      valueType: "NUMBER",
      unitContext: "INCHES",
      interpretationScope: "ANSWER",
    },
    strokeType: {
      slotType: "WEDGE_CONTEXT",
      valueType: "ENUM",
      unitContext: null,
      interpretationScope: "ANSWER",
    },
    productType: {
      slotType: "CATEGORY",
      valueType: "ENUM",
      unitContext: null,
      interpretationScope: "TARGET_SELECTION",
    },
  };
  return (
    slots[id] ?? {
      slotType: "CATEGORY",
      valueType: "TEXT",
      unitContext: null,
      interpretationScope: "ANSWER",
    }
  );
}

export function nextBestQuestion(
  category: string,
  known: Record<string, unknown>,
): NextBestQuestion | null {
  const question = rawNextBestQuestion(category, known);
  return question ? { ...question, ...nextQuestionSlot(question.id) } : null;
}

function rawNextBestQuestion(
  category: string,
  known: Record<string, unknown>,
): RawNextBestQuestion | null {
  const value = category.toLowerCase();
  const clubCategory =
    value.includes("driver") ||
    value.includes("fairway") ||
    value.includes("hybrid") ||
    value.includes("iron") ||
    value.includes("wedge") ||
    value.includes("putter");
  if (clubCategory && !known.handedness)
    return {
      id: "handedness",
      prompt: "¿Juegas como diestro o zurdo?",
      category: value.toUpperCase(),
      reason: "Define la compatibilidad física de la configuración",
      critical: true,
    };
  if (value.includes("driver") && !known.objective)
    return {
      id: "objective",
      prompt: "¿Qué quieres mejorar con tu próximo driver?",
      category: "DRIVER",
      reason: "Cambia materialmente el perfil técnico",
      critical: true,
    };
  if (value.includes("driver") && !known.shotTendency)
    return {
      id: "shotTendency",
      prompt: "¿Tu fallo más común es slice, hook o un vuelo recto?",
      category: "DRIVER",
      reason:
        "Puede cambiar la compatibilidad con ajustes explícitos del driver",
      critical: false,
    };
  if (
    (value.includes("driver") ||
      value.includes("fairway") ||
      value.includes("hybrid") ||
      value.includes("iron")) &&
    !known.swingSpeed
  )
    return {
      id: "swingSpeed",
      prompt: "¿Conoces tu velocidad de swing aproximada?",
      category: value.toUpperCase(),
      reason: "Mejora la validación técnica del flex y peso de la varilla",
      critical: false,
    };
  if (
    (value.includes("fairway") || value.includes("hybrid")) &&
    !known.currentBag
  )
    return {
      id: "currentBag",
      prompt: "¿Qué maderas, híbridos o hierros largos llevas actualmente?",
      category: value.includes("hybrid") ? "HYBRID" : "FAIRWAY_WOOD",
      reason: "Permite detectar huecos y redundancias evidentes",
      critical: false,
    };
  if (value.includes("iron") && !known.skill)
    return {
      id: "skill",
      prompt: "¿Cuál es tu handicap o nivel de juego actual?",
      category: "IRON",
      reason: "Ayuda a validar el perfil técnico y la tolerancia del set",
      critical: false,
    };
  if (value.includes("wedge") && !known.gapping)
    return {
      id: "gapping",
      prompt: "¿Qué distancia o hueco quieres cubrir?",
      category: "WEDGE",
      reason: "El loft y el uso dependen del hueco",
      critical: true,
    };
  if (value.includes("wedge") && !known.turfInteraction)
    return {
      id: "turfInteraction",
      prompt:
        "¿Tu golpe de wedge suele entrar profundo, neutro o barrer el pasto?",
      category: "WEDGE",
      reason: "Bounce y grind requieren contexto de interacción con el terreno",
      critical: false,
    };
  if (value.includes("putter") && !known.length)
    return {
      id: "length",
      prompt: "¿Qué longitud de putter usas actualmente?",
      category: "PUTTER",
      reason: "Ayuda a limitar opciones incompatibles",
      critical: false,
    };
  if (value.includes("putter") && !known.strokeType)
    return {
      id: "strokeType",
      prompt:
        "¿Conoces si tu stroke es recto, con arco leve o con arco marcado?",
      category: "PUTTER",
      reason:
        "Permite evaluar propiedades de stroke declaradas por el fabricante",
      critical: false,
    };
  if (
    (value.includes("apparel") ||
      value.includes("polo") ||
      value.includes("shoe")) &&
    !known.productType
  )
    return {
      id: "productType",
      prompt: "¿Qué tipo de producto buscas?",
      category: "APPAREL",
      reason: "El tipo de producto es la identidad principal",
      critical: true,
    };
  return null;
}

export const MATCH_CATEGORIES = [
  "DRIVER",
  "FAIRWAY_WOOD",
  "HYBRID",
  "IRON",
  "WEDGE",
  "PUTTER",
] as const;
export type MatchCategory = (typeof MATCH_CATEGORIES)[number];
export type EquipmentMatchStatus = "MATCH" | "INCOMPATIBLE";
export type MatchConfidence = "HIGH" | "MEDIUM" | "LOW";
export type EquipmentMatchReasonSeverity =
  "POSITIVE" | "NEUTRAL" | "TRADEOFF" | "WARNING" | "INCOMPATIBILITY";
export type EquipmentMatchComponent =
  | "HANDEDNESS"
  | "PLAYER_LEVEL"
  | "SHAFT"
  | "LOFT"
  | "SHOT_TENDENCY"
  | "BAG_GAP"
  | "CONFIGURATION";

export type EquipmentMatchReason = {
  code: string;
  severity: EquipmentMatchReasonSeverity;
  component: EquipmentMatchComponent;
  scoreImpact: number;
};

export type MissingMatchData = {
  field: string;
  code: string;
  importance: "CRITICAL" | "MATERIAL" | "HELPFUL";
};

export type MatchEvidence<T> = {
  value: T;
  source: MemorySource;
  confidence: MemoryConfidence;
};

export type EquipmentUnitSpecifications = {
  handedness?: "RIGHT" | "LEFT" | "UNKNOWN" | string | null;
  loftDegrees?: number | null;
  shaftFlex?: string | null;
  shaftMaterial?: string | null;
  shaftWeightGrams?: number | null;
  adjustableLoft?: boolean | null;
  adjustableHosel?: boolean | null;
  forgiveness?: "HIGH" | "MEDIUM" | "LOW" | null;
  playerProfile?:
    "BEGINNER" | "IMPROVING" | "INTERMEDIATE" | "ADVANCED" | "TOUR" | null;
  drawBias?: boolean | null;
  launchProfile?: "HIGH" | "MID" | "LOW" | null;
  spinProfile?: "HIGH" | "MID" | "LOW" | null;
  role?: string | null;
  carryDistanceYards?: number | null;
  setMakeup?: string[] | null;
  bounceDegrees?: number | null;
  grind?: string | null;
  putterHeadType?: "BLADE" | "MALLET" | string | null;
  strokeFit?: "STRAIGHT" | "SLIGHT_ARC" | "STRONG_ARC" | string | null;
  lengthInches?: number | null;
  lieDegrees?: number | null;
  clubLengthInches?: number | null;
};

export type EquipmentUnit = {
  id: string;
  category: MatchCategory | string;
  brand: string | null;
  model: string | null;
  canonicalModelId: string | null;
  condition: string | null;
  source: MemorySource;
  confidence: MemoryConfidence;
  specifications: EquipmentUnitSpecifications;
};

export type EquipmentMatchMeasurements = {
  swingSpeedMph?: MatchEvidence<number> | null;
  turfInteraction?: MatchEvidence<"SHALLOW" | "NEUTRAL" | "STEEP"> | null;
  playingConditions?: MatchEvidence<"SOFT" | "MIXED" | "FIRM"> | null;
  strokeType?: MatchEvidence<"STRAIGHT" | "SLIGHT_ARC" | "STRONG_ARC"> | null;
  putterLengthInches?: MatchEvidence<number> | null;
  lieFitKnown?: MatchEvidence<boolean> | null;
  lengthFitKnown?: MatchEvidence<boolean> | null;
};

export type EquipmentMatchInput = {
  golfer: MiGolfProfile | null;
  currentEquipment: MiGolfEquipment[];
  objectives: MiGolfObjective[];
  measurements?: EquipmentMatchMeasurements;
  equipmentUnit: EquipmentUnit;
};

export type CategoryMatchProfile = {
  category: MatchCategory;
  ruleVersion: string;
  baseScore: number;
  weights: Readonly<Record<EquipmentMatchComponent, number>>;
};

export type EquipmentMatch = {
  status: EquipmentMatchStatus;
  matchScore: number;
  confidence: MatchConfidence;
  category: MatchCategory;
  ruleVersion: string;
  reasons: EquipmentMatchReason[];
  tradeoffs: EquipmentMatchReason[];
  missingData: MissingMatchData[];
  nextBestQuestion: NextBestQuestion | null;
};
export type RecommendationConfidence = "HIGH" | "MEDIUM" | "LOW";
export type InventoryAvailability = "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";
export type InventorySource = "FIRST_PARTY" | "MARKETPLACE";
export type BudgetFit =
  "WITHIN_BUDGET" | "SLIGHTLY_ABOVE" | "MATERIALLY_ABOVE" | "UNKNOWN";
export type ValueClass = "BEST" | "GOOD" | "STANDARD" | "WEAK" | "UNKNOWN";
export type PersonalFitReason =
  "PREFERRED_BRAND" | "CONDITION_PREFERENCE_MATCH" | "CONDITION_ACCEPTABLE";
export type PersonalFit = {
  score: number;
  reasons: PersonalFitReason[];
  brandPreferenceMatched: boolean;
  conditionPreferenceMatched: boolean;
};
export type CommercialFit = {
  budgetFit: BudgetFit;
  valueClass: ValueClass;
  availability: InventoryAvailability;
  commercialTieBreakEligible: boolean;
};

export type InventoryUnit = {
  productId: string;
  productHref?: string | null;
  unitId: string;
  canonicalModelId: string | null;
  source: InventorySource;
  category: string;
  brand: string | null;
  model: string | null;
  condition: string | null;
  priceMxnMinor: number | null;
  availability: InventoryAvailability;
  stock: number | null;
  technicalSpecs: EquipmentUnitSpecifications;
};

export type InventoryCandidate = {
  unit: InventoryUnit;
  equipmentMatch: EquipmentMatch;
};

export type BestRoundRecommendationRequest = {
  golferContext: MiGolfProfile | null;
  equipment: MiGolfEquipment[];
  objectives: MiGolfObjective[];
  sessionContext: BestRoundProSessionSummary;
  requestedCategory: string;
  candidateInventory: InventoryCandidate[];
};

export type BestRoundRecommendationResult = {
  bestOption: InventoryUnit | null;
  bestValue: InventoryUnit | null;
  alternative: InventoryUnit | null;
  missingInformation: string[];
  confidence: RecommendationConfidence;
  explanationData: {
    strengths: string[];
    tradeoffs: string[];
    fitRationale: string[];
  };
};

export type TargetProfile = {
  id: string;
  category: string;
  desiredFitCriteria: Record<string, unknown>;
  criticalSpecs: Record<string, unknown>;
  optionalSpecs: Record<string, unknown>;
  budgetMxnMinor: number | null;
  minimumMatchScore: number;
  baselineAvailableMatch: number | null;
  active: boolean;
};

export type RecommendationSnapshot = {
  id: string;
  createdAt: string;
  golferEvidence: Pick<
    BestRoundRecommendationRequest,
    "golferContext" | "equipment" | "objectives"
  >;
  productsConsidered: InventoryCandidate[];
  result: BestRoundRecommendationResult;
  engineVersion: string;
  explanationData: BestRoundRecommendationResult["explanationData"];
};

export const FUNNEL_EVENTS = [
  "SESSION_STARTED",
  "DIAGNOSIS_PROGRESS",
  "MATCH_GENERATED",
  "RECOMMENDATION_VIEWED",
  "PRODUCT_VIEWED",
  "ADD_TO_CART",
  "CHECKOUT_STARTED",
  "PURCHASE_COMPLETED",
  "MI_GOLF_UPDATED",
  "SAVED_SEARCH_CREATED",
  "HUMAN_HANDOFF",
] as const;
export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

export function validateHandicap(value: number | null): boolean {
  return (
    value === null || (Number.isFinite(value) && value >= 0 && value <= 54)
  );
}

export const MEMORY_POLICY = {
  autoSave: [
    "explicit handedness",
    "explicit handicap",
    "explicit current equipment",
    "explicit durable preference",
  ],
  confirmBeforePersisting: [
    "inferred preference",
    "inferred equipment change",
    "inferred objective",
  ],
  sessionOnly: [
    "temporary budget",
    "buying today",
    "promotion objection",
    "purchase urgency",
  ],
  neverSave: ["irrelevant chit-chat", "unsupported inference"],
} as const;
