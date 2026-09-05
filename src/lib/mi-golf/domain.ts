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
};

export function nextBestQuestion(
  category: string,
  known: Record<string, unknown>,
): NextBestQuestion | null {
  const value = category.toLowerCase();
  if (value.includes("driver") && !known.objective)
    return {
      id: "objective",
      prompt: "¿Qué quieres mejorar con tu próximo driver?",
      category: "DRIVER",
      reason: "Cambia materialmente el perfil técnico",
      critical: true,
    };
  if (value.includes("driver") && !known.handedness)
    return {
      id: "handedness",
      prompt: "¿Juegas como diestro o zurdo?",
      category: "DRIVER",
      reason: "Define compatibilidad de configuración",
      critical: true,
    };
  if (value.includes("wedge") && !known.gapping)
    return {
      id: "gapping",
      prompt: "¿Qué distancia o hueco quieres cubrir?",
      category: "WEDGE",
      reason: "El loft y el uso dependen del hueco",
      critical: true,
    };
  if (value.includes("putter") && !known.length)
    return {
      id: "length",
      prompt: "¿Qué longitud de putter usas actualmente?",
      category: "PUTTER",
      reason: "Ayuda a limitar opciones incompatibles",
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

export type EquipmentMatch = {
  status: "MATCH" | "INCOMPATIBLE";
  matchScore: number;
  reasons: string[];
};
export type RecommendationConfidence = "HIGH" | "MEDIUM" | "LOW";
export type PersonalFit = {
  score: number;
  reasons: string[];
  brandPreference?: string | null;
  stylePreference?: string | null;
};
export type CommercialFit = {
  score: number;
  priceMxnMinor: number | null;
  budgetFit: "WITHIN" | "ABOVE" | "UNKNOWN";
  availability: "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";
  condition: string | null;
};

export type InventoryCandidate = {
  id: string;
  source: "FIRST_PARTY" | "MARKETPLACE";
  category: string;
  brand: string | null;
  model: string | null;
  condition: string | null;
  priceMxnMinor: number | null;
  availability: "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";
  specifications: Record<string, unknown>;
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
  bestOption: InventoryCandidate | null;
  bestValue: InventoryCandidate | null;
  alternative: InventoryCandidate | null;
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
