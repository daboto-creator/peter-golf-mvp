/** Provider-independent discovery contracts. Not imported by production code. */

export const SWING_AI_CONTRACT_VERSION = "swing-ai-discovery-v1" as const;

export type EvidenceProvenance =
  | "VIDEO_OBSERVED"
  | "USER_DECLARED"
  | "PROFILE_EXISTING"
  | "CATALOG_VERIFIED"
  | "DERIVED"
  | "UNKNOWN";
export type EvidenceConfidence = "HIGH" | "MEDIUM" | "LOW" | "UNAVAILABLE";
export type ClubCategory =
  "DRIVER" | "FAIRWAY_WOOD" | "HYBRID" | "IRON" | "WEDGE" | "PUTTER";

export type Evidence<T> = {
  value: T | null;
  provenance: EvidenceProvenance;
  confidence: EvidenceConfidence;
  observedAt: string;
  evidenceRefs: string[];
  model?: { id: string; version: string } | null;
};

export type SwingAnalysisStatus =
  | "UPLOADED"
  | "QUEUED"
  | "PROCESSING"
  | "SUCCEEDED"
  | "INSUFFICIENT_QUALITY"
  | "FAILED_RETRYABLE"
  | "FAILED_FINAL"
  | "DELETION_PENDING"
  | "DELETED";
export type CameraPerspective =
  "FACE_ON" | "DOWN_THE_LINE" | "FRONT_OBLIQUE" | "REAR_OBLIQUE" | "UNKNOWN";

export type SwingAnalysis = {
  schemaVersion: typeof SWING_AI_CONTRACT_VERSION;
  id: string;
  userId: string;
  idempotencyKey: string;
  videoObjectPath: string;
  status: SwingAnalysisStatus;
  consentVersion: string;
  consentedAt: string;
  capture: {
    durationMs: number;
    mimeType: string;
    sizeBytes: number;
    perspective: CameraPerspective;
  };
  model: { id: string; version: string; runtime: "BROWSER" | "SERVER" } | null;
  attempts: number;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string;
  failureCode: string | null;
};

export type VisualObservationKind =
  | "ADDRESS_KNEE_FLEX"
  | "ADDRESS_TORSO_ORIENTATION"
  | "LATERAL_DISPLACEMENT_APPARENT"
  | "ARM_POSITION_RELATIVE"
  | "POSE_TRACKING_CONSISTENCY"
  | "POSTURE_CHANGE_GENERAL";
export type VisualObservation = {
  schemaVersion: typeof SWING_AI_CONTRACT_VERSION;
  id: string;
  analysisId: string;
  kind: VisualObservationKind;
  value: "LOW" | "NEUTRAL" | "HIGH" | "VARIABLE" | "NOT_OBSERVABLE";
  perspective: CameraPerspective;
  confidence: number;
  usableFrameRatio: number;
  frameRange: { startMs: number; endMs: number } | null;
  provenance: "VIDEO_OBSERVED";
  model: { id: string; version: string };
  limitations: string[];
};

export type GolferFittingProfile = {
  schemaVersion: typeof SWING_AI_CONTRACT_VERSION;
  userId: string;
  requestedCategory: ClubCategory | null;
  handedness: Evidence<"RIGHT" | "LEFT" | "UNKNOWN">;
  handicap: Evidence<number>;
  skillLevel: Evidence<"BEGINNER" | "INTERMEDIATE" | "ADVANCED">;
  shotTendency: Evidence<string>;
  swingSpeedMph: Evidence<number>;
  currentEquipmentIds: Evidence<string[]>;
  objectives: Evidence<string[]>;
  budgetMxnMinor: Evidence<number>;
  visualObservationIds: string[];
  unknownFields: string[];
};

export type FittingQuestion = {
  schemaVersion: typeof SWING_AI_CONTRACT_VERSION;
  id: string;
  category: ClubCategory;
  slot: string;
  prompt: string;
  valueType: "TEXT" | "NUMBER" | "ENUM" | "BOOLEAN" | "EQUIPMENT_LIST";
  criticality: "CRITICAL" | "MATERIAL" | "HELPFUL";
  whyItMatters: string;
  allowedValues: string[] | null;
  askedAt: string | null;
};
export type FittingAnswer = {
  schemaVersion: typeof SWING_AI_CONTRACT_VERSION;
  questionId: string;
  userId: string;
  value: string | number | boolean | string[];
  provenance: "USER_DECLARED";
  confidence: "HIGH";
  answeredAt: string;
  durableSaveApproved: boolean;
};

export type EquipmentRequirement = {
  schemaVersion: typeof SWING_AI_CONTRACT_VERSION;
  category: ClubCategory;
  attribute: string;
  operator: "EQ" | "IN" | "RANGE" | "PREFER" | "AVOID";
  value: string | number | boolean | string[] | [number, number];
  class: "CRITICAL" | "TECHNICAL" | "PREFERENCE";
  evidence: Evidence<string | number | boolean>;
  explanationCode: string;
};
export type RecommendationCandidate = {
  schemaVersion: typeof SWING_AI_CONTRACT_VERSION;
  productId: string;
  unitId: string;
  source: "FIRST_PARTY" | "MARKETPLACE";
  catalogVerifiedAt: string;
  availability: "AVAILABLE" | "UNAVAILABLE";
  priceMxnMinor: number;
  criticalRules: Array<{ code: string; passed: boolean }>;
  scoredRules: Array<{
    code: string;
    weight: number;
    outcome: "SUPPORTED" | "TRADEOFF" | "UNKNOWN";
  }>;
  missingCriticalData: string[];
};
export type RecommendationExplanation = {
  code: string;
  messageKey: string;
  provenance: EvidenceProvenance;
  evidenceRefs: string[];
  confidence: EvidenceConfidence;
  requiresProfessionalValidation: boolean;
};
export type FittingRecommendation = {
  schemaVersion: typeof SWING_AI_CONTRACT_VERSION;
  id: string;
  userId: string;
  analysisId: string | null;
  category: ClubCategory;
  status: "RECOMMENDATIONS" | "NEEDS_MORE_DATA" | "NO_SUITABLE_MATCH";
  engine: { id: "rules-first-fitting"; version: string };
  profileSnapshot: GolferFittingProfile;
  requirements: EquipmentRequirement[];
  candidates: RecommendationCandidate[];
  selected: Array<{
    productId: string;
    unitId: string;
    role: "BEST_OPTION" | "BEST_VALUE" | "ALTERNATIVE";
  }>;
  explanations: RecommendationExplanation[];
  pendingQuestions: FittingQuestion[];
  createdAt: string;
};
