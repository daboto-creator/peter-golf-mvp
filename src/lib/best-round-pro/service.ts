import "server-only";

import { getAuthenticatedUser } from "@/lib/auth/user";
import {
  classifyConversationTurn,
  priceObjectionReply,
  recommendationReply,
  terminalOutcomeMessage,
  type ConversationOutcome,
  type ConversationOutcomeResult,
  type ConversationState,
  evaluateFocusedProductAgainstKnownFacts,
  getNextProductAdviceQuestion,
  getPlayerPerspective,
  resolveProductReference,
  resolveSearchScope,
  questionPromptFor,
  normalizeStructuredFactValue,
  validateCanonicalFactValue,
  normalizeCanonicalFactStatus,
  resolvePendingAnswerFact,
  deriveSkillFromHandicap,
  FACT_VALUE_DOMAINS,
  type CanonicalCurrentTurnFact,
  type ConversationProductContext,
} from "@/lib/best-round-pro/conversation";
import type { DialogueAct, FactMutationIntent } from "@/lib/best-round-pro/contract";
import { getPublicProductBySlug } from "@/lib/catalog/public-products";
import { normalizeMatchCategory } from "@/lib/matching/equipment-matching";
import type {
  MiGolfEquipment,
  MiGolfObjective,
  MiGolfProfile,
} from "@/lib/mi-golf/domain";
import {
  rankInventoryCandidates,
  matchInventoryCandidates,
  type RankingPreferences,
} from "@/lib/recommendations/commercial-ranking";
import { loadInventoryUnits } from "@/lib/recommendations/inventory-candidates";
import { createClient } from "@/lib/supabase/server";
import {
  getConversationProvider,
  safeRecommendationPayload,
} from "@/lib/best-round-pro/provider";
import {
  isCatalogIntent,
  routeConversationIntent,
  isAdviceMetaQuestion,
  isProductAdviceLanguage,
  normalizeConversationText,
  fallbackSocialIntent,
} from "@/lib/best-round-pro/intent-router";
import { searchCommercialCatalog, searchCatalogScope } from "@/lib/best-round-pro/catalog-search";
import type { CatalogProductReference } from "@/lib/best-round-pro/conversation";
import {
  answerProductKnowledge,
  answerStoreKnowledge,
  classifyKnowledgeIntent,
  toProductKnowledge,
  type KnowledgeIntent,
} from "@/lib/best-round-pro/product-knowledge";

export function canonicalProductFamily(product: CatalogProductReference): string {
  if (product.family && product.family !== "club") return product.family.toUpperCase();
  const category = product.category?.toUpperCase() ?? "";
  return (["DRIVER", "FAIRWAY_WOOD", "HYBRID", "IRON", "WEDGE", "PUTTER", "SET"] as const)
    .find((family) => category.includes(family.replace("_", " ")) || category === family) ?? "EQUIPMENT";
}

export function safeFamilyLanguage(product: CatalogProductReference) {
  switch (canonicalProductFamily(product)) {
    case "WEDGE": return "este wedge y su papel en el juego corto, loft y gapping";
    case "DRIVER": return "este driver, su loft, shaft y comportamiento desde el tee";
    case "FAIRWAY_WOOD": return "esta madera, su loft y uso desde fairway o tee";
    case "HYBRID": return "este híbrido y el espacio que puede cubrir entre maderas e hierros";
    case "IRON": return "estos hierros, su composición, distancia y gapping";
    case "PUTTER": return "este putter y su comportamiento en el green";
    case "SET": return "este set, su composición y los palos incluidos";
    default: return "este equipo y sus especificaciones disponibles";
  }
}

function familyLabel(family: string) {
  return ({
    SET: "set",
    DRIVER: "driver",
    FAIRWAY_WOOD: "madera de calle",
    HYBRID: "híbrido",
    IRON: "hierros",
    WEDGE: "wedge",
    PUTTER: "putter",
  } as Record<string, string>)[family] ?? "producto de esta categoría";
}

function targetLevelForSet(input: { setType?: string | null; name: string; category?: string | null }) {
  if (input.setType === "starter_set") return "BEGINNER" as const;
  // Catalog positioning is authoritative when the product record uses the
  // known beginner-oriented naming/category vocabulary; otherwise remain
  // UNKNOWN instead of inventing a player level.
  if (input.setType === "complete_set" && /\bstrata\b|\bstarter\b|\bbeginner\b|\bentry[- ]level\b/i.test(`${input.name} ${input.category ?? ""}`)) {
    return "BEGINNER" as const;
  }
  return input.setType === "complete_set" ? "ALL_LEVELS" as const : null;
}

function productReferenceFromSummary(product: Awaited<ReturnType<typeof searchCatalogScope>>["products"][number]): CatalogProductReference {
  const family = product.productFamily === "set"
    ? "SET"
    : product.clubType?.toUpperCase() ?? product.productFamily;
  const targetPlayerLevel = targetLevelForSet(product);
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    category: product.categoryName,
    condition: product.condition,
    price: product.price,
    productHref: `/productos/${encodeURIComponent(product.slug)}`,
    imagePath: product.images[0]?.storagePath ?? null,
    handedness: product.handedness,
    family,
    targetPlayerLevel,
  };
}

async function comparableAlternatives(input: {
  product: CatalogProductReference;
  family: string;
  handedness?: "LEFT" | "RIGHT";
}) {
  const result = await searchCatalogScope({
    families: [input.family],
    handedness: input.handedness,
  });
  const products = result.products
    .filter((product) => product.id !== input.product.id)
    .filter((product) => {
      const productFamily = product.productFamily === "set"
        ? "SET"
        : product.clubType?.toUpperCase() ?? product.productFamily;
      return productFamily === input.family;
    })
    .map(productReferenceFromSummary);
  return { products, error: result.error };
}

type ProfileRow = Record<string, unknown>;
export type ConversationInterpreterTelemetry = {
  providerCalled: boolean;
  providerSucceeded: boolean;
  providerErrorType: string | null;
  interpretationSource: "LLM" | "FALLBACK";
  interpretationConfidence: number | null;
  stage?: string;
  errorCode?: string | null;
  providerHttpStatus?: number | null;
  providerTimedOut?: boolean;
  jsonParsed?: boolean | null;
  validationIssues?: Array<{ field?: string; path: string; code: string; expected?: string; received?: string; receivedValue?: string | number | boolean | null }>;
  dialogueAct?: string | null;
  rawDialogueAct?: string | null;
  effectiveDialogueAct?: string | null;
  answersPendingQuestion?: boolean;
  declaredFactKeys?: string[];
  declaredFactStatuses?: string[];
  declaredFacts?: Array<{ key: string; canonicalValue: string | number | number[] | null; status: string }>;
  requestedProductFamilies?: string[];
  searchContinuationRelation?: string | null;
  searchContinuationReason?: string | null;
  catalogScopeIntent?: string | null;
  semanticStateChanged?: boolean;
  playerFactsChanged?: boolean;
  pendingQuestionChanged?: boolean;
  pendingBefore?: string | null;
  pendingFactKeyMatched?: string | null;
  pendingNormalizerUsed?: string | null;
  normalizedPendingValue?: string | number | number[] | null;
  pendingConsumed?: boolean;
  loopPrevented?: boolean;
  loopReason?: string | null;
  pendingAfter?: string | null;
  rawDeclaredFacts?: Array<{ key: string; status: string; source: string }>;
  acceptedCurrentTurnFacts?: Array<{ key: string; canonicalValue: string | number | number[] | null; status: string; source: string }>;
  rejectedContextEchoFacts?: Array<{ key: string; reason: string }>;
  factMutationIntent?: FactMutationIntent;
  playerFactsBefore?: Record<string, string | number | boolean | number[] | null>;
  playerFactsAfter?: Record<string, string | number | boolean | number[] | null>;
  activeAdviceProductId?: string | null;
  activeAdviceProductFamily?: string | null;
  activeAdviceStatus?: string | null;
  adviceOutcome?: string | null;
  adviceEvidenceSufficient?: boolean;
  materialMissingFactKeys?: string[];
  resolvedMaterialFactKeys?: string[];
  productChangedThisTurn?: boolean;
  previousProductId?: string | null;
  compatibilityOutcomeBeforeReset?: string | null;
  compatibilityOutcomeAfterReset?: string | null;
  playerFactsCarriedForward?: string[];
  nextQuestionKey?: string | null;
  currentProductId?: string | null;
  comparableAlternativeIds?: string[];
  comparableAlternativeCount?: number;
  comparisonEligible?: boolean;
  comparisonOffered?: boolean;
  technicalCompatibility?: string | null;
  playerLevelFit?: string | null;
  targetPlayerLevel?: string | null;
  recommendationStrength?: string | null;
  knowledgeIntent?: KnowledgeIntent;
  factsRequested?: string[];
  factsResolved?: string[];
  factsUnavailable?: string[];
  productSourceType?: string | null;
  availabilityStatus?: string | null;
  conditionStatus?: string | null;
  policyTopic?: string | null;
  policyResolutionStatus?: string | null;
  productReadinessStatus?: string | null;
};

let lastInterpreterTelemetry: ConversationInterpreterTelemetry = {
  providerCalled: false,
  providerSucceeded: false,
  providerErrorType: null,
  interpretationSource: "FALLBACK",
  interpretationConfidence: null,
  stage: "LOAD_CONTEXT",
  errorCode: null,
  providerHttpStatus: null,
  providerTimedOut: false,
  jsonParsed: null,
  validationIssues: [],
  dialogueAct: null,
  answersPendingQuestion: false,
  declaredFactKeys: [],
  declaredFactStatuses: [],
  declaredFacts: [],
  requestedProductFamilies: [],
  searchContinuationRelation: null,
  searchContinuationReason: null,
  catalogScopeIntent: null,
  pendingNormalizerUsed: null,
  normalizedPendingValue: null,
  pendingConsumed: false,
  loopPrevented: false,
  loopReason: null,
  activeAdviceProductId: null,
  activeAdviceProductFamily: null,
  activeAdviceStatus: null,
  adviceOutcome: null,
  adviceEvidenceSufficient: false,
  materialMissingFactKeys: [],
  resolvedMaterialFactKeys: [],
  productChangedThisTurn: false,
  playerFactsCarriedForward: [],
  previousProductId: null,
  compatibilityOutcomeBeforeReset: null,
  compatibilityOutcomeAfterReset: null,
  nextQuestionKey: null,
  currentProductId: null,
  comparableAlternativeIds: [],
  comparableAlternativeCount: 0,
  comparisonEligible: false,
  comparisonOffered: false,
  technicalCompatibility: null,
  playerLevelFit: null,
  targetPlayerLevel: null,
  recommendationStrength: null,
  knowledgeIntent: null,
  factsRequested: [],
  factsResolved: [],
  factsUnavailable: [],
  productSourceType: null,
  availabilityStatus: null,
  conditionStatus: null,
  policyTopic: null,
  policyResolutionStatus: null,
  productReadinessStatus: null,
};

export function getLastInterpreterTelemetry() {
  return lastInterpreterTelemetry;
}

function recordAdviceTelemetry(state: ConversationState, outcome: string | null, sufficient: boolean, missing: string[] = []) {
  lastInterpreterTelemetry.activeAdviceProductId = state.activeAdvice?.productId ?? state.productAdvice?.product?.id ?? null;
  lastInterpreterTelemetry.activeAdviceProductFamily = state.activeAdvice?.productFamily ?? null;
  lastInterpreterTelemetry.activeAdviceStatus = state.activeAdvice?.status ?? null;
  lastInterpreterTelemetry.adviceOutcome = outcome ?? state.activeAdvice?.outcome ?? null;
  lastInterpreterTelemetry.adviceEvidenceSufficient = sufficient;
  lastInterpreterTelemetry.materialMissingFactKeys = missing;
  lastInterpreterTelemetry.nextQuestionKey = state.pendingQuestionKey;
}

function telemetryPlayerFacts(answers: Record<string, string | number | boolean | number[] | null>) {
  return Object.fromEntries(
    ["handedness", "setExperience", "skill", "skillSource", "handicapIndex", "handicapStatus", "handicapSource", "handicap", "shotTendency", "swingSpeed"]
      .filter((key) => answers[key] !== undefined)
      .map((key) => [key, answers[key]]),
  );
}

function isCanonicalFactValue(value: unknown): value is string | number | number[] {
  return typeof value === "string" || typeof value === "number" || (Array.isArray(value) && value.every((item) => typeof item === "number"));
}

function profileFrom(
  row: ProfileRow | null,
  userId: string,
): MiGolfProfile | null {
  if (!row) return null;
  return {
    userId,
    handicap: typeof row.handicap === "number" ? row.handicap : null,
    handedness:
      row.handedness === "RIGHT" || row.handedness === "LEFT"
        ? row.handedness
        : "UNKNOWN",
    skillLevel: typeof row.skill_level === "string" ? row.skill_level : null,
    playFrequency:
      typeof row.play_frequency === "string" ? row.play_frequency : null,
    shotTendency:
      typeof row.shot_tendency === "string" ? row.shot_tendency : null,
    preferences: {},
    source: "USER_DECLARED",
    confidence: "HIGH",
  };
}

export async function loadMiGolfContext() {
  const user = await getAuthenticatedUser();
  if (!user)
    return {
      user: null,
      profile: null,
      equipment: [] as MiGolfEquipment[],
      objectives: [] as MiGolfObjective[],
    };
  const supabase = await createClient();
  const [{ data: profile }, { data: equipment }, { data: objectives }] =
    await Promise.all([
      supabase
        .from("mi_golf_profiles" as never)
        .select("handicap,handedness,skill_level,play_frequency,shot_tendency")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("mi_golf_equipment" as never)
        .select(
          "id,category,brand,model,specifications,source,confidence,notes,is_active",
        )
        .eq("user_id", user.id)
        .eq("is_active", true),
      supabase
        .from("mi_golf_objectives" as never)
        .select("id,objective_type,status,details,source,confidence")
        .eq("user_id", user.id),
    ]);
  return {
    user,
    profile: profileFrom((profile ?? null) as ProfileRow | null, user.id),
    equipment: (equipment ?? []) as unknown as MiGolfEquipment[],
    objectives: (objectives ?? []) as unknown as MiGolfObjective[],
  };
}

export async function processConversationTurn(input: {
  state: ConversationState;
  message: string;
  currentPageProduct?: ConversationProductContext | null;
}) {
  const withFinalReply = <T extends { state: ConversationState; reply: string }>(
    result: T,
  ): T => ({
    ...result,
    state: {
      ...result.state,
      messages: result.state.messages.map((message, index, messages) =>
        index === messages.length - 1 && message.role === "assistant"
          ? { ...message, content: result.reply }
          : message,
      ),
    },
  });
  let context: Awaited<ReturnType<typeof loadMiGolfContext>>;
  try {
    lastInterpreterTelemetry.stage = "LOAD_CONTEXT";
    context = await loadMiGolfContext();
  } catch (error) {
    // Mi Golf is enrichment; a transient profile failure must not turn a
    // conversational request into an HTTP 503 when a safe anonymous path is
    // still available.
    lastInterpreterTelemetry = {
      ...lastInterpreterTelemetry,
      stage: "LOAD_CONTEXT",
      errorCode: error instanceof Error ? error.name : "CONTEXT_LOAD_FAILED",
    };
    context = { user: null, profile: null, equipment: [], objectives: [] };
  }
  const fallbackIntent = routeConversationIntent(input.message);
  let pageProductReference: CatalogProductReference | null = null;
  let pageProductData: Awaited<ReturnType<typeof getPublicProductBySlug>>["data"] = null;
  if (input.currentPageProduct) {
    const loaded = await getPublicProductBySlug(input.currentPageProduct.slug);
    if (loaded.data) {
      pageProductData = loaded.data;
      pageProductReference = {
        id: loaded.data.id,
        slug: loaded.data.slug,
        name: loaded.data.name,
        category: loaded.data.categoryName,
        condition: loaded.data.condition,
        price: loaded.data.price,
        productHref: `/productos/${encodeURIComponent(loaded.data.slug)}`,
        imagePath: loaded.data.images[0]?.storagePath ?? null,
        handedness: loaded.data.handedness ?? loaded.data.setSpecs?.handedness ?? null,
        family: loaded.data.productFamily,
        targetPlayerLevel: targetLevelForSet({ setType: loaded.data.setType, name: loaded.data.name, category: loaded.data.categoryName }),
      };
    }
  }
  const previousAdviceProductId = input.state.activeAdvice?.productId ?? input.state.productAdvice?.product?.id ?? input.state.lastFocusedProduct?.id ?? null;
  const productChangedThisTurn = Boolean(pageProductReference && previousAdviceProductId && pageProductReference.id !== previousAdviceProductId);
  let preFocusedProduct = pageProductReference ?? input.state.lastInteractedProduct ?? input.state.productAdvice?.product ?? input.state.lastFocusedProduct ??
    (input.state.lastCatalogResults.length === 1 ? input.state.lastCatalogResults[0] : null);
  let preFocusedProductSource: ConversationState["focusedProductSource"] = pageProductReference
    ? "CURRENT_PAGE"
    : input.state.lastInteractedProduct
      ? "PRODUCT_CARD_CLICK"
      : input.state.productAdvice?.product || input.state.lastFocusedProduct
        ? input.state.focusedProductSource ?? "RECOMMENDATION"
        : input.state.lastCatalogResults.length === 1 ? "UNIQUE_RECENT_RESULT" : null;
  const provider = getConversationProvider();
  let interpretation: Awaited<ReturnType<NonNullable<typeof provider>["interpretTurn"]>> | null = null;
  lastInterpreterTelemetry = {
    providerCalled: Boolean(provider),
    providerSucceeded: false,
    providerErrorType: null,
    interpretationSource: "FALLBACK",
    interpretationConfidence: null,
  };
  if (provider) {
    try {
      lastInterpreterTelemetry.stage = "INTERPRET_TURN";
      const pendingKey = input.state.productAdvice?.pendingQuestionKey ?? input.state.pendingQuestionKey;
      const pendingMeaning: Record<string, string> = {
        handedness: "ASK_PLAYER_HANDEDNESS",
        setExperience: "ASK_SET_EXPERIENCE",
        skill: "ASK_PLAYER_HANDICAP",
        handicap: "ASK_PLAYER_HANDICAP",
        handicapIndex: "ASK_PLAYER_HANDICAP",
        objective: "ASK_PLAYER_OBJECTIVE",
        shotTendency: "ASK_SHOT_TENDENCY",
        swingSpeed: "ASK_SWING_SPEED",
      };
      interpretation = await provider.interpretTurn({
        session: {
          category: input.state.session.requestedCategory,
          targetCategory: input.state.session.requestedCategory,
          intent: input.state.session.purchaseIntent,
          budgetKnown: input.state.session.budgetMxnMinor !== null,
          knownFacts: Object.keys(input.state.session.diagnosticAnswers),
        },
        userTurn: input.message,
        nextQuestionKey: input.state.productAdvice?.pendingQuestionKey ?? input.state.pendingQuestionKey,
        pendingQuestionSlotType: input.state.pendingQuestionSlotType,
        conversationContext: {
          recentTurns: input.state.messages.slice(-6),
          focusedProduct: preFocusedProduct ? { name: preFocusedProduct.name, family: preFocusedProduct.family } : null,
          currentPageProduct: pageProductReference ? { id: pageProductReference.id, name: pageProductReference.name, family: pageProductReference.family } : null,
          lastInteractedProduct: input.state.lastInteractedProduct ? { id: input.state.lastInteractedProduct.id, name: input.state.lastInteractedProduct.name, family: input.state.lastInteractedProduct.family } : null,
          activeAdvice: Boolean(input.state.productAdvice?.active),
          previousSearchFamilies: input.state.searchScope?.families ?? [],
          previousSearchOutcome: input.state.catalogSearchOutcome,
          lastExecutedAction: input.state.lastExecutedAction,
          participantContext: {
            relationToBuyer: input.state.participants.player.relationToBuyer,
            displayReference: input.state.participants.player.displayReference,
          },
          pendingQuestion: pendingKey ? {
            key: pendingKey,
            meaning: pendingMeaning[pendingKey] ?? "ANSWER_PENDING_QUESTION",
            targetEntity: "PLAYER",
            expectedValues: pendingKey === "handedness" ? [...FACT_VALUE_DOMAINS.handedness]
              : pendingKey === "skill" ? [...FACT_VALUE_DOMAINS.skill]
                : pendingKey === "setExperience" ? [...FACT_VALUE_DOMAINS.setExperience]
                  : pendingKey === "handicap" || pendingKey === "handicapIndex" ? ["0.0-54.0"]
                  : [],
            allowedStatuses: pendingKey === "objective" ? ["KNOWN", "UNKNOWN", "NONE", "DECLINED"] : ["KNOWN", "UNKNOWN", "DECLINED"],
          } : null,
          pendingAssistantOffer: input.state.pendingAssistantOffer ? {
            action: input.state.pendingAssistantOffer.action,
            targetProducts: input.state.lastCatalogResults
              .filter((product) => input.state.pendingAssistantOffer?.targetProductIds.includes(product.id))
              .map((product) => ({ id: product.id, name: product.name, family: product.family })),
          } : null,
        },
      });
      if (interpretation.catalogScopeIntent === "ALL_HANDED_EQUIPMENT" && interpretation.dialogueAct === "ASK_COMPARISON") {
        interpretation = { ...interpretation, dialogueAct: "CATALOG_SEARCH" };
      }
      lastInterpreterTelemetry = {
        ...lastInterpreterTelemetry,
        providerSucceeded: true,
        interpretationSource: "LLM",
        interpretationConfidence: interpretation.confidence,
        stage: "REDUCE_STATE",
        dialogueAct: interpretation.dialogueAct,
        rawDialogueAct: interpretation.rawDialogueAct ?? interpretation.dialogueAct,
        effectiveDialogueAct: interpretation.dialogueAct,
        answersPendingQuestion: interpretation.answersPendingQuestion,
        declaredFactKeys: interpretation.declaredFacts.map((fact) => fact.field),
        declaredFactStatuses: interpretation.declaredFacts.map((fact) => fact.semanticStatus),
        declaredFacts: interpretation.declaredFacts.map((fact) => ({
          key: fact.field,
          canonicalValue: isCanonicalFactValue(fact.value) ? normalizeStructuredFactValue(fact.field, fact.value) : null,
          status: fact.semanticStatus,
        })),
        requestedProductFamilies: interpretation.requestedProductFamilies,
        searchContinuationRelation: interpretation.searchContinuationRelation,
        searchContinuationReason: interpretation.searchContinuationReason,
        catalogScopeIntent: interpretation.catalogScopeIntent,
        rawDeclaredFacts: interpretation.declaredFacts.map((fact) => ({
          key: fact.field,
          status: fact.semanticStatus,
          source: fact.source,
        })),
        factMutationIntent: interpretation.factMutationIntent,
      };
    } catch (error) {
      lastInterpreterTelemetry = {
        ...lastInterpreterTelemetry,
        providerErrorType: error instanceof Error ? error.name : "UNKNOWN",
        stage: "INTERPRET_TURN",
        errorCode: "INTERPRETER_FALLBACK",
        providerHttpStatus: error && typeof error === "object" && "diagnostics" in error
          ? (error as { diagnostics?: { httpStatus?: number } }).diagnostics?.httpStatus ?? null
          : null,
        providerTimedOut: error instanceof Error && error.name === "AbortError",
        jsonParsed: error && typeof error === "object" && "diagnostics" in error
          ? (error as { diagnostics?: { jsonParsed?: boolean } }).diagnostics?.jsonParsed ?? null
          : null,
        validationIssues: error && typeof error === "object" && "diagnostics" in error
          ? (error as { diagnostics?: { validationIssues?: ConversationInterpreterTelemetry["validationIssues"] } }).diagnostics?.validationIssues ?? []
          : [],
      };
      interpretation = null;
    }
  }
  let explicitProduct: CatalogProductReference | null = null;
  if (interpretation?.productReference) {
    const reference = interpretation.productReference.trim().toLowerCase();
    const candidates = [
      ...(pageProductReference ? [pageProductReference] : []),
      ...(input.state.lastInteractedProduct ? [input.state.lastInteractedProduct] : []),
      ...(input.state.lastFocusedProduct ? [input.state.lastFocusedProduct] : []),
      ...input.state.lastCatalogResults,
    ];
    explicitProduct = candidates.find((product) =>
      product.name.toLowerCase() === reference || product.slug.toLowerCase() === reference || product.id.toLowerCase() === reference,
    ) ?? null;
  }
  const referenceResolution = resolveProductReference({
    currentPageProduct: pageProductReference,
    lastInteractedProduct: input.state.lastInteractedProduct,
    focusedProduct: input.state.productAdvice?.product ?? input.state.lastFocusedProduct,
    recentResults: input.state.lastCatalogResults,
    explicitProduct,
    explicitSubjectChange: interpretation?.dialogueAct === "CHANGE_PRODUCT",
  });
  preFocusedProduct = referenceResolution.product;
  preFocusedProductSource = referenceResolution.source === "CURRENT_PAGE"
    ? "CURRENT_PAGE"
    : referenceResolution.source === "PRODUCT_CARD_CLICK"
      ? "PRODUCT_CARD_CLICK"
      : referenceResolution.source === "EXPLICIT_NAME"
        ? "EXPLICIT_NAME"
        : referenceResolution.source === "UNIQUE_RECENT_RESULT"
          ? "UNIQUE_RECENT_RESULT"
          : referenceResolution.source === "FOCUSED_CONTEXT"
            ? input.state.focusedProductSource ?? "RECOMMENDATION"
            : null;
  const normalizedMessage = normalizeConversationText(input.message);
  const knowledgeIntent = classifyKnowledgeIntent(input.message);
  let knowledgeProductData = pageProductData;
  if (knowledgeIntent && preFocusedProduct && !knowledgeProductData) {
    const loadedKnowledgeProduct = await getPublicProductBySlug(preFocusedProduct.slug);
    knowledgeProductData = loadedKnowledgeProduct.data;
  }
  lastInterpreterTelemetry.knowledgeIntent = knowledgeIntent;
  const participants = {
    ...input.state.participants,
    player: {
      ...input.state.participants.player,
      relationToBuyer: interpretation?.entities.purchaseTarget === "OTHER_PERSON"
        ? interpretation.entities.relationship === "SPOUSE" ? "SPOUSE" : interpretation.entities.relationship === "CHILD" ? "CHILD" : interpretation.entities.relationship === "FRIEND" ? "FRIEND" : "OTHER"
        : input.state.participants.player.relationToBuyer,
      displayReference: interpretation?.entities.playerReference ?? input.state.participants.player.displayReference,
      facts: { ...input.state.participants.player.facts },
    },
  };
  // Conservative fallback when the semantic provider is unavailable: resolve
  // the participant from grammatical subject, never from a product keyword.
  if (!interpretation) {
    const relation = /\b(?:mi\s+espos[oa]|mi\s+marid[oa])\b/.test(normalizedMessage)
      ? "SPOUSE" : /\bmi\s+hij[oa]\b/.test(normalizedMessage)
        ? "CHILD" : /\bmi\s+amig[oa]\b/.test(normalizedMessage)
          ? "FRIEND" : /\b(?:para|por)\s+(?:el|ella|una?\s+persona)\b/.test(normalizedMessage)
            ? "OTHER" : "SELF";
    if (relation !== "SELF") {
      participants.player.relationToBuyer = relation;
      participants.player.displayReference = relation === "SPOUSE" ? "tu esposo" : relation === "CHILD" ? "tu hijo" : relation === "FRIEND" ? "tu amigo" : "la persona para quien lo buscas";
    }
  }
  const pendingKey = input.state.productAdvice?.pendingQuestionKey ?? input.state.pendingQuestionKey;
  const pendingAnswerCandidate = resolvePendingAnswerFact(pendingKey, normalizedMessage);
  const existingPendingValue = pendingKey ? input.state.session.diagnosticAnswers[pendingKey] : undefined;
  const pendingAnswerFact = pendingAnswerCandidate &&
    (existingPendingValue === undefined || existingPendingValue === null || existingPendingValue === pendingAnswerCandidate.value)
    ? pendingAnswerCandidate
    : null;
  const normalizedProviderFacts: CanonicalCurrentTurnFact[] = (interpretation?.declaredFacts ?? []).filter((fact) => {
    const value = isCanonicalFactValue(fact.value)
      ? normalizeStructuredFactValue(fact.field, fact.value)
      : undefined;
    return validateCanonicalFactValue(fact.field, value, normalizeCanonicalFactStatus(fact.field, value, fact.semanticStatus));
  }).map((fact) => ({
    ...fact,
    value: isCanonicalFactValue(fact.value)
      ? normalizeStructuredFactValue(fact.field, fact.value)
      : fact.value,
    semanticStatus: normalizeCanonicalFactStatus(
      fact.field,
      isCanonicalFactValue(fact.value) ? normalizeStructuredFactValue(fact.field, fact.value) : fact.value,
      fact.semanticStatus,
    ),
    source: fact.source,
  }));
  const canonicalFacts: CanonicalCurrentTurnFact[] = pendingAnswerFact ? [pendingAnswerFact] : [];
  const rejectedContextEchoFacts: Array<{ key: string; reason: string }> = [];
  const existingAnswers = input.state.session.diagnosticAnswers;
  for (const fact of normalizedProviderFacts) {
    if (pendingAnswerFact?.field === fact.field) continue;
    const existing = existingAnswers[fact.field];
    const hasExisting = existing !== undefined && existing !== null && existing !== "";
    if (pendingKey && fact.field === pendingKey && (!hasExisting || existing === fact.value)) {
      canonicalFacts.push({ ...fact, source: "CURRENT_USER_PENDING_ANSWER" });
      continue;
    }
    const isCorrection = fact.source === "CURRENT_USER_CORRECTION" &&
      interpretation?.factMutationIntent === "CORRECT_EXISTING" &&
      (interpretation.rawDialogueAct ?? interpretation.dialogueAct) === "CORRECTION";
    const isNewExplicit = fact.source === "CURRENT_USER_EXPLICIT" &&
      interpretation?.factMutationIntent === "SET_NEW" && !hasExisting;
    if (isCorrection || isNewExplicit) {
      canonicalFacts.push(fact);
      continue;
    }
    rejectedContextEchoFacts.push({
      key: fact.field,
      reason: hasExisting ? "KNOWN_FACT_NOT_EXPLICITLY_CORRECTED" : "NO_CURRENT_TURN_MUTATION_EVIDENCE",
    });
  }
  const pendingFactMatches = (fact: CanonicalCurrentTurnFact) => Boolean(
    pendingKey && (fact.field === pendingKey ||
      (pendingKey === "skill" && ["handicapIndex", "handicapStatus"].includes(fact.field)) ||
      (pendingKey === "objective" && fact.field === "driverObjective") ||
      (pendingKey === "gapping" && fact.field === "currentWedgeLofts")),
  );
  const answeredPending = Boolean(pendingKey && canonicalFacts.some(pendingFactMatches));
  const rawDialogueAct = interpretation?.rawDialogueAct ?? interpretation?.dialogueAct ?? null;
  const effectiveDialogueAct: DialogueAct | null = answeredPending
    ? "ANSWER_PENDING_QUESTION"
    : interpretation?.dialogueAct === "CONFIRMATION" && pendingKey && !input.state.pendingAssistantOffer
      ? "OTHER"
      : interpretation?.dialogueAct ?? null;
  if (interpretation) {
    interpretation = {
      ...interpretation,
      dialogueAct: effectiveDialogueAct ?? "OTHER",
      answersPendingQuestion: answeredPending || interpretation.answersPendingQuestion,
    };
  }
  for (const fact of canonicalFacts) {
    participants.player.facts[fact.field] = { status: fact.semanticStatus, value: fact.value, confidence: interpretation?.confidence ?? 1, source: "USER" };
    if (fact.field === "handedness" && fact.semanticStatus === "KNOWN" && (fact.value === "LEFT" || fact.value === "RIGHT")) {
      const applied = participants.player.facts.handedness?.value;
      if (applied !== fact.value) throw new Error("CANONICAL_FACT_APPLICATION_FAILED");
    }
  }
  const interpretedAnswers = Object.fromEntries(
    canonicalFacts.map((fact) => [
      fact.field,
      fact.semanticStatus === "NONE" ? "NONE" :
        fact.semanticStatus === "UNKNOWN" ? "ANSWERED_UNKNOWN" :
          fact.semanticStatus === "DECLINED" ? "DECLINED" : fact.value,
    ]),
  );
  const resolvedFactKeysThisTurn = new Set<string>(
    canonicalFacts
      .filter((fact) => fact.semanticStatus === "KNOWN")
      .map((fact) => fact.field),
  );
  const resolvedSearchScope = resolveSearchScope(
    input.state.searchScope,
    interpretation?.requestedProductFamilies ?? [],
    interpretation?.searchScopeMode,
    interpretation?.category,
    effectiveDialogueAct === "CATALOG_SEARCH",
    input.state.catalogSearchOutcome,
    interpretation?.searchContinuationRelation,
    interpretation?.searchContinuationReason,
    interpretation?.catalogScopeIntent,
  );
  // Single semantic reduction point. Every policy/domain branch below reads
  // this updated state, never the stale input snapshot.
  const reducedDiagnosticAnswers = {
    ...input.state.session.diagnosticAnswers,
    ...interpretedAnswers,
  } as Record<string, string | number | boolean | number[] | null>;
  if (typeof reducedDiagnosticAnswers.handicapIndex === "number" && reducedDiagnosticAnswers.handicapIndex >= 0 && reducedDiagnosticAnswers.handicapIndex <= 54) {
    reducedDiagnosticAnswers.handicapStatus = "KNOWN";
    reducedDiagnosticAnswers.handicapSource ??= "USER_DECLARED";
    reducedDiagnosticAnswers.skill = deriveSkillFromHandicap(reducedDiagnosticAnswers.handicapIndex);
    reducedDiagnosticAnswers.skillSource = "DERIVED_FROM_HANDICAP";
    reducedDiagnosticAnswers.setExperience ??= "CURRENT_PLAYER";
    reducedDiagnosticAnswers.setExperienceSource ??= "DERIVED_FROM_HANDICAP";
  }
  const updatedState: ConversationState = {
    ...input.state,
    session: {
      ...input.state.session,
      requestedCategory: interpretation?.category ?? input.state.session.requestedCategory,
      diagnosticAnswers: reducedDiagnosticAnswers,
    },
    participants,
    pendingQuestionKey: productChangedThisTurn || answeredPending ? null : input.state.pendingQuestionKey,
    pendingQuestionCategory: productChangedThisTurn || answeredPending ? null : input.state.pendingQuestionCategory,
    pendingQuestionSlotType: productChangedThisTurn || answeredPending ? null : input.state.pendingQuestionSlotType,
    productAdvice: productChangedThisTurn
      ? { active: false, product: pageProductReference, pendingQuestionKey: null, collectedAnswers: input.state.session.diagnosticAnswers }
      : answeredPending && input.state.productAdvice
        ? { ...input.state.productAdvice, pendingQuestionKey: null }
        : input.state.productAdvice,
    activeAdvice: productChangedThisTurn ? null : input.state.activeAdvice,
    lastInteractedProduct: input.state.lastInteractedProduct,
    focusedProductSource: preFocusedProductSource,
    referenceResolution: {
      productId: referenceResolution.productId,
      source: referenceResolution.source,
    },
    searchScope: resolvedSearchScope,
    searchContinuation: interpretation?.searchContinuationRelation
      ? {
          relation: interpretation.searchContinuationRelation,
          reason: interpretation.searchContinuationReason ?? "EXPLICIT_CURRENT_TURN",
        }
      : null,
    catalogSearchOutcome: input.state.catalogSearchOutcome,
    compatibilityOutcome: productChangedThisTurn ? null : input.state.compatibilityOutcome,
  };
  lastInterpreterTelemetry.playerFactsChanged = canonicalFacts.length > 0;
  lastInterpreterTelemetry.pendingQuestionChanged = (pendingKey ?? null) !== (answeredPending ? null : pendingKey ?? null);
  lastInterpreterTelemetry.semanticStateChanged = canonicalFacts.length > 0 || Boolean(answeredPending);
  lastInterpreterTelemetry.rawDialogueAct = rawDialogueAct;
  lastInterpreterTelemetry.effectiveDialogueAct = effectiveDialogueAct;
  lastInterpreterTelemetry.dialogueAct = effectiveDialogueAct;
  lastInterpreterTelemetry.answersPendingQuestion = answeredPending || interpretation?.answersPendingQuestion || false;
  lastInterpreterTelemetry.pendingBefore = pendingKey ?? null;
  lastInterpreterTelemetry.pendingFactKeyMatched = answeredPending ? pendingKey : null;
  lastInterpreterTelemetry.pendingNormalizerUsed = pendingAnswerFact ? `PENDING_${pendingAnswerFact.field}` : null;
  lastInterpreterTelemetry.normalizedPendingValue = pendingAnswerFact?.value ?? null;
  lastInterpreterTelemetry.pendingConsumed = answeredPending;
  lastInterpreterTelemetry.resolvedMaterialFactKeys = [...resolvedFactKeysThisTurn];
  lastInterpreterTelemetry.pendingAfter = answeredPending ? null : pendingKey ?? null;
  lastInterpreterTelemetry.acceptedCurrentTurnFacts = canonicalFacts.map((fact) => ({
    key: fact.field,
    canonicalValue: fact.value,
    status: fact.semanticStatus,
    source: fact.source,
  }));
  lastInterpreterTelemetry.rejectedContextEchoFacts = rejectedContextEchoFacts;
  lastInterpreterTelemetry.factMutationIntent = interpretation?.factMutationIntent ?? (pendingAnswerFact ? "SET_NEW" : "NONE");
  lastInterpreterTelemetry.playerFactsBefore = telemetryPlayerFacts(input.state.session.diagnosticAnswers);
  lastInterpreterTelemetry.playerFactsAfter = telemetryPlayerFacts(updatedState.session.diagnosticAnswers);
  lastInterpreterTelemetry.productChangedThisTurn = productChangedThisTurn;
  lastInterpreterTelemetry.previousProductId = previousAdviceProductId;
  lastInterpreterTelemetry.compatibilityOutcomeBeforeReset = input.state.compatibilityOutcome;
  lastInterpreterTelemetry.compatibilityOutcomeAfterReset = updatedState.compatibilityOutcome;
  lastInterpreterTelemetry.playerFactsCarriedForward = Object.keys(updatedState.session.diagnosticAnswers).filter((key) => input.state.session.diagnosticAnswers[key] !== undefined);
  lastInterpreterTelemetry.declaredFacts = canonicalFacts.map((fact) => ({
    key: fact.field,
    canonicalValue: isCanonicalFactValue(fact.value) ? fact.value : null,
    status: fact.semanticStatus,
  }));
  const playerPerspective = getPlayerPerspective(participants);
  const intent = interpretation?.category === "SET" || interpretation?.dialogueAct === "CATALOG_SEARCH" || interpretation?.dialogueAct === "PRODUCT_DETAILS"
    ? "CATALOG_SEARCH" as const
    : interpretation?.dialogueAct === "PRODUCT_ADVICE" || interpretation?.dialogueAct === "FITTING_REQUEST" || interpretation?.dialogueAct === "ASK_PRODUCT_FIT"
      ? "FITTING_RECOMMENDATION" as const
      : interpretation?.dialogueAct === "ASK_COMPARISON"
        ? "PRODUCT_COMPARISON" as const
        : fallbackIntent;
  const asksWhatData = interpretation
    ? interpretation.asksWhatInformationNeeded
    : isAdviceMetaQuestion(input.message);
  const asksProductAdvice = interpretation
    ? interpretation.dialogueAct === "PRODUCT_ADVICE" || interpretation.dialogueAct === "FITTING_REQUEST"
    : isProductAdviceLanguage(input.message);
  const asksProductFit = interpretation?.dialogueAct === "ASK_PRODUCT_FIT";
  const requestsRecommendation = asksProductAdvice || interpretation?.dialogueAct === "FITTING_REQUEST";
  const asksProductReason = interpretation
    ? interpretation.dialogueAct === "ASK_PRODUCT_REASON" || interpretation.asksForExplanation
    : /\bpor\s+que|porque|que\s+viste|por\s+que\s+lo\b/.test(normalizedMessage);
  const personalFitReason = interpretation?.reasonMode === "PERSONAL_FIT_REASON";
  const focusedProduct = preFocusedProduct;
  const socialAct = interpretation?.dialogueAct ?? (intent === "OTHER" ? fallbackSocialIntent(input.message) : null);
  const activeAdviceContinuation = Boolean(
    updatedState.activeAdvice && focusedProduct && updatedState.activeAdvice.productId === focusedProduct.id &&
      !interpretation?.topicChanged && ["HELP_REQUEST", "CONFIRMATION", "OTHER", "GENERAL_QUESTION"].includes(interpretation?.dialogueAct ?? socialAct ?? ""),
  );
  const appendSocialReply = (reply: string, event: string) => ({
    state: { ...updatedState, lastExecutedAction: event, messages: [...updatedState.messages, { role: "user" as const, content: input.message }, { role: "assistant" as const, content: reply }] },
    reply, nextQuestion: null, objection: null, events: [event], recommendation: null, outcome: null, intent,
  });
  const appendKnowledgeReply = (reply: string, event: string, productData?: NonNullable<typeof knowledgeProductData>) => {
    const product = focusedProduct ?? null;
    const state: ConversationState = {
      ...updatedState,
      messages: [...updatedState.messages, { role: "user", content: input.message }, { role: "assistant", content: reply }],
      lastFocusedProduct: product ?? updatedState.lastFocusedProduct,
      focusedProductSource: product ? preFocusedProductSource : updatedState.focusedProductSource,
      lastExecutedAction: event,
    };
    if (productData) {
      const dto = toProductKnowledge(productData);
      lastInterpreterTelemetry.productSourceType = dto.sourceType;
      lastInterpreterTelemetry.availabilityStatus = dto.availability;
      lastInterpreterTelemetry.conditionStatus = dto.condition;
      lastInterpreterTelemetry.productReadinessStatus = dto.readiness;
      lastInterpreterTelemetry.factsResolved = Object.entries(dto.specs).filter(([, value]) => value !== null).map(([key]) => key);
      lastInterpreterTelemetry.factsUnavailable = Object.entries(dto.specs).filter(([, value]) => value === null).map(([key]) => key);
    }
    return { state, reply, nextQuestion: null, objection: null, events: [event], recommendation: null, outcome: null, intent: "PRODUCT_DETAILS" as const };
  };
  if (knowledgeIntent && knowledgeIntent !== "PRODUCT_COMPARISON") {
    lastInterpreterTelemetry.policyTopic = knowledgeIntent.startsWith("STORE_") ? knowledgeIntent : null;
    lastInterpreterTelemetry.policyResolutionStatus = knowledgeIntent.startsWith("STORE_") ? "NOT_IMPLEMENTED_OR_PARTIAL" : null;
    const policyReply = answerStoreKnowledge(knowledgeIntent);
    if (policyReply) return appendSocialReply(policyReply, "RETURN_STORE_POLICY");
    if (knowledgeProductData && focusedProduct) {
      const dto = toProductKnowledge(knowledgeProductData);
      const reply = answerProductKnowledge(knowledgeIntent, dto);
      if (reply) return appendKnowledgeReply(reply, knowledgeIntent === "PRODUCT_PRICE" ? "RETURN_PRODUCT_PRICE" : knowledgeIntent === "PRODUCT_AVAILABILITY" || knowledgeIntent === "PURCHASE_READINESS" ? "RETURN_PRODUCT_AVAILABILITY" : "RETURN_PRODUCT_FACTS", knowledgeProductData);
    }
    if (!focusedProduct) return appendKnowledgeReply("Dime qué producto quieres consultar o abre su ficha para revisar el dato exacto.", "RETURN_KNOWLEDGE_GAP");
    return appendKnowledgeReply("Esa información no está registrada para este producto.", "RETURN_KNOWLEDGE_GAP", knowledgeProductData ?? undefined);
  }
  if (!updatedState.productAdvice?.active && !activeAdviceContinuation && intent === "OTHER" && socialAct) {
    const replies: Record<string, string> = {
      GREETING: "¡Hola! Soy Best Round Pro. Puedo ayudarte a encontrar equipo, comparar productos, revisar disponibilidad o asesorarte según tu juego. ¿Qué estás buscando?",
      THANKS: "Con gusto. Si quieres, también puedo ayudarte a comparar opciones o revisar otra categoría.",
      GOODBYE: "¡Hasta luego! Cuando quieras, aquí estaré para ayudarte.",
      HELP_REQUEST: "Puedo ayudarte a buscar productos, resolver dudas del catálogo, comparar opciones o encontrar equipo según tu juego.",
      SMALL_TALK: "Claro, sin problema. Puedes preguntarme lo que quieras y te ayudo a comparar sin compromiso.",
      USER_FRUSTRATION: "Tienes razón; gracias por decírmelo. Tomo en cuenta lo que ya me compartiste y no te haré repetirlo.",
    };
    if (replies[socialAct]) return appendSocialReply(replies[socialAct], `SOCIAL_${socialAct}`);
  }
  if (updatedState.productAdvice?.active && interpretation?.dialogueAct === "GENERAL_QUESTION" && !activeAdviceContinuation) {
    return appendSocialReply("Te lo pregunto porque ayuda a orientar el equipo al nivel de juego y evitar una opción demasiado exigente. Si no lo sabes, podemos seguir con otros datos.", "ADVICE_QUESTION_ANSWERED");
  }
  const confirmsProductAdvice = interpretation?.dialogueAct === "CONFIRMATION" &&
    updatedState.pendingAssistantOffer?.action === "START_PRODUCT_ADVICE";
  const startsProductEvaluation = asksProductFit || confirmsProductAdvice ||
    (asksProductReason && personalFitReason) || asksProductAdvice || activeAdviceContinuation || intent === "PRODUCT_COMPARISON" ||
    (!answeredPending && asksWhatData && updatedState.pendingQuestionCategory !== "PRODUCT_ADVICE");
  if (startsProductEvaluation) {
    if (!focusedProduct && updatedState.lastCatalogResults.length > 1) {
      const reply = "¿Cuál de las opciones quieres que revise? Selecciona un producto o dime su nombre.";
      const state: ConversationState = {
        ...updatedState,
        messages: [...updatedState.messages, { role: "user", content: input.message }, { role: "assistant", content: reply }],
        referenceResolution: { productId: null, source: "CLARIFICATION_REQUIRED" },
        lastExecutedAction: "CLARIFY_PRODUCT_REFERENCE",
      };
      return { state, reply, nextQuestion: null, objection: null, events: ["PRODUCT_REFERENCE_CLARIFICATION"], recommendation: null, outcome: null, intent: "PRODUCT_ADVICE" as const };
    }
    if (focusedProduct) {
      const answers = updatedState.session.diagnosticAnswers;
      const playerHand = answers.handedness;
      const productHand = typeof focusedProduct.handedness === "string" ? focusedProduct.handedness.toUpperCase() : null;
      if ((playerHand === "LEFT" || playerHand === "RIGHT") && (productHand === "LEFT" || productHand === "RIGHT") && playerHand !== productHand) {
        const playerLabel = playerHand === "LEFT" ? "zurdo" : "diestro";
        const productLabel = productHand === "LEFT" ? "zurdo" : "diestro";
        const reply = `No. Este ${focusedProduct.name} es para ${productLabel}, así que no te sirve si juegas ${playerLabel}.`;
        const state: ConversationState = {
          ...updatedState,
          messages: [...updatedState.messages, { role: "user", content: input.message }, { role: "assistant", content: reply }],
          lastFocusedProduct: focusedProduct,
          focusedProductSource: preFocusedProductSource,
          compatibilityOutcome: "HARD_INCOMPATIBLE",
          lastExecutedAction: "RETURN_HARD_INCOMPATIBILITY",
          pendingAssistantOffer: null,
          productAdvice: { active: false, product: focusedProduct, pendingQuestionKey: null, collectedAnswers: answers },
          activeAdvice: { productId: focusedProduct.id, productFamily: canonicalProductFamily(focusedProduct), status: "CONCLUDED", outcome: "HARD_INCOMPATIBLE" },
        };
        recordAdviceTelemetry(state, "HARD_INCOMPATIBLE", true);
        return { state, reply, nextQuestion: null, objection: null, events: ["PRODUCT_FIT_HARD_INCOMPATIBILITY"], recommendation: null, outcome: null, intent: "PRODUCT_ADVICE" as const };
      }
      const nextAdviceQuestion = getNextProductAdviceQuestion({ answers, productFamily: canonicalProductFamily(focusedProduct) });
      if (nextAdviceQuestion) {
        const question = questionPromptFor(nextAdviceQuestion, playerPerspective, focusedProduct.category) ??
          "¿Qué otro dato de tu juego puedes compartir?";
        const reply = asksWhatData
          ? `Para evaluar ${focusedProduct.name}, el siguiente dato material que necesito es: ${question}`
          : `Para revisar si ${focusedProduct.name} encaja ${playerPerspective.isSelf ? "contigo" : `con el juego de ${playerPerspective.subject}`}, ${question}`;
        const state: ConversationState = {
          ...updatedState,
          messages: [...updatedState.messages, { role: "user", content: input.message }, { role: "assistant", content: reply }],
          pendingQuestionKey: nextAdviceQuestion.key,
          pendingQuestionCategory: "PRODUCT_ADVICE",
          pendingQuestionSlotType: ["skill", "handicap", "handicapIndex"].includes(nextAdviceQuestion.key) ? "HANDICAP" : nextAdviceQuestion.key === "setExperience" ? "BOOLEAN_PREFERENCE" : "HANDEDNESS",
          lastFocusedProduct: focusedProduct,
          focusedProductSource: preFocusedProductSource,
          productAdvice: { active: true, product: focusedProduct, pendingQuestionKey: nextAdviceQuestion.key, collectedAnswers: answers },
          activeAdvice: { productId: focusedProduct.id, productFamily: canonicalProductFamily(focusedProduct), status: "NEEDS_ONE_MORE_FACT" },
          pendingAssistantOffer: null,
          lastExecutedAction: "ASK_NEXT_QUESTION",
        };
        recordAdviceTelemetry(state, "NEED_MORE_INFORMATION", false, [nextAdviceQuestion.key]);
        return { state, reply, nextQuestion: null, objection: null, events: [confirmsProductAdvice ? "PRODUCT_ADVICE_CONFIRMED" : "PRODUCT_ADVICE_STARTED"], recommendation: null, outcome: null, intent: "PRODUCT_ADVICE" as const };
      }
      const family = canonicalProductFamily(focusedProduct);
      const alternatives = await comparableAlternatives({
        product: focusedProduct,
        family,
        handedness: playerHand === "LEFT" || playerHand === "RIGHT" ? playerHand : undefined,
      });
      const isAdvancedEntrySet = family === "SET" && answers.skill === "ADVANCED" && focusedProduct.targetPlayerLevel === "BEGINNER";
      const valueReason = family === "WEDGE"
        ? "su papel en el juego corto y el espacio de loft que puede cubrir"
        : family === "DRIVER"
          ? "su función desde el tee y el objetivo de distancia que me indicaste"
          : family === "SET" && isAdvancedEntrySet
            ? "es un set completo y sencillo, aunque está posicionado para quien empieza"
            : safeFamilyLanguage(focusedProduct);
      const comparison = alternatives.products.length === 0
        ? `Con lo que sabemos, yo mantendría este ${familyLabel(family)} como candidato; ahora mismo no tengo otro ${familyLabel(family)} comparable disponible.`
        : alternatives.products.length === 1
          ? `Si quieres contrastarlo, tengo una alternativa comparable de ${familyLabel(family)}: ${alternatives.products[0].name}.`
          : `Si quieres contrastarlo, tengo ${alternatives.products.length} alternativas comparables de ${familyLabel(family)}.`;
      const reply = isAdvancedEntrySet
        ? `Te puede servir técnicamente, pero no sería mi primera recomendación para tu perfil. ${focusedProduct.name} está orientado a un jugador que empieza o busca un paquete completo sencillo; con Handicap Index ${answers.handicapIndex}, probablemente aprovecharías mejor un equipo más específico. ${comparison}`
        : `Sí, te lo recomendaría con la información que me diste: ${valueReason}. ${comparison}`;
      const state: ConversationState = {
        ...updatedState,
        messages: [...updatedState.messages, { role: "user", content: input.message }, { role: "assistant", content: reply }],
        lastFocusedProduct: focusedProduct,
        focusedProductSource: preFocusedProductSource,
        compatibilityOutcome: "MATCH",
        pendingAssistantOffer: null,
        productAdvice: { active: false, product: focusedProduct, pendingQuestionKey: null, collectedAnswers: answers },
        activeAdvice: { productId: focusedProduct.id, productFamily: family, status: "CONCLUDED", outcome: isAdvancedEntrySet ? "RECOMMENDED_WITH_CAVEAT" : "RECOMMENDED" },
        lastExecutedAction: "EXPLAIN_PERSONAL_FIT",
      };
      lastInterpreterTelemetry.currentProductId = focusedProduct.id;
      lastInterpreterTelemetry.comparableAlternativeIds = alternatives.products.map((product) => product.id);
      lastInterpreterTelemetry.comparableAlternativeCount = alternatives.products.length;
      lastInterpreterTelemetry.comparisonEligible = true;
      lastInterpreterTelemetry.comparisonOffered = alternatives.products.length > 0;
      lastInterpreterTelemetry.technicalCompatibility = "MATCH";
      lastInterpreterTelemetry.playerLevelFit = isAdvancedEntrySet ? "CAVEAT" : "MATCH";
      lastInterpreterTelemetry.targetPlayerLevel = focusedProduct.targetPlayerLevel ?? "UNKNOWN";
      lastInterpreterTelemetry.recommendationStrength = isAdvancedEntrySet ? "CONDITIONAL" : "STRONG";
      recordAdviceTelemetry(state, isAdvancedEntrySet ? "RECOMMENDED_WITH_CAVEAT" : "RECOMMENDED", true);
      return { state, reply, nextQuestion: null, objection: null, events: ["PRODUCT_FIT_EXPLAINED"], recommendation: null, outcome: null, intent: "PRODUCT_ADVICE" as const };
    }
  }
  if (asksProductReason && focusedProduct && !updatedState.productAdvice?.active) {
    const targetPhrase = playerPerspective.isSelf ? "encaja contigo" : `encaja con el juego de ${playerPerspective.displayReference}`;
    const familyLanguage = safeFamilyLanguage(focusedProduct);
    const reply = `Te mostré ${focusedProduct.name} porque es una opción disponible del catálogo (${familyLanguage}). Eso todavía no significa que sea la mejor para ti. Si quieres, revisamos si ${targetPhrase}.`;
    const state: ConversationState = { ...updatedState, messages: [...updatedState.messages, { role: "user", content: input.message }, { role: "assistant", content: reply }], lastFocusedProduct: focusedProduct, pendingAssistantOffer: { action: "START_PRODUCT_ADVICE", targetProductIds: [focusedProduct.id], createdAtTurn: updatedState.messages.length + 1 }, lastExecutedAction: "EXPLAIN_CATALOG_REASON" };
    return { state, reply, nextQuestion: null, objection: null, events: ["PRODUCT_REASON_EXPLAINED"], recommendation: null, outcome: null, intent: "PRODUCT_ADVICE" as const };
  }
  if (focusedProduct && (updatedState.productAdvice?.active || updatedState.pendingQuestionCategory === "PRODUCT_ADVICE")) {
    const answers = { ...updatedState.session.diagnosticAnswers };
    for (const fact of canonicalFacts) {
      if (["handedness", "handicap", "handicapIndex", "handicapStatus", "setExperience", "skill", "skillSource", "objective", "driverObjective", "currentWedgeLofts"].includes(fact.field))
        answers[fact.field] = fact.semanticStatus === "NONE" ? "NONE" : fact.semanticStatus === "UNKNOWN" ? "ANSWERED_UNKNOWN" : fact.semanticStatus === "DECLINED" ? "DECLINED" : fact.value;
      if (fact.field === "skill" && fact.semanticStatus === "KNOWN") answers.skillSource = "USER_DECLARED";
      if (fact.field === "handicapIndex" && fact.semanticStatus === "KNOWN") answers.handicapSource = "USER_DECLARED";
    }
    if (typeof answers.handicapIndex === "number") {
      answers.handicapStatus = "KNOWN";
      answers.handicapSource = "USER_DECLARED";
      answers.skill = deriveSkillFromHandicap(answers.handicapIndex);
      answers.skillSource = "DERIVED_FROM_HANDICAP";
      answers.setExperience ??= "CURRENT_PLAYER";
      answers.setExperienceSource ??= "DERIVED_FROM_HANDICAP";
    } else if (answers.handicapStatus === "NONE") {
      answers.handicapIndex = null;
      answers.skill = "BEGINNER";
      answers.skillSource = "DERIVED_NO_HANDICAP";
    }
    const hand = !interpretation && /\b(?:zurdo|zurda|izquierdo|izquierda|left)\b/.test(normalizedMessage)
      ? "LEFT"
      : !interpretation && /\b(?:diestro|diestra|derecho|derecha|right)\b/.test(normalizedMessage)
        ? "RIGHT"
        : null;
    if (hand) answers.handedness = hand;
    const asksData = asksWhatData;
    const knownHand = answers.handedness === "LEFT" || answers.handedness === "RIGHT";
    const evaluation = evaluateFocusedProductAgainstKnownFacts({ product: focusedProduct, answers });
    const normalizedProductHand = typeof focusedProduct.handedness === "string" ? focusedProduct.handedness.toUpperCase() : null;
    const productHand = normalizedProductHand === "LEFT" || normalizedProductHand === "RIGHT" ? normalizedProductHand : null;
    if (evaluation.status === "HARD_INCOMPATIBLE" && (answers.handedness === "LEFT" || answers.handedness === "RIGHT") && productHand) {
      const playerHand = answers.handedness;
      const familyFromScope = updatedState.searchScope?.families?.length === 1 ? updatedState.searchScope.families[0] : null;
      const familyFromProduct = focusedProduct.family === "SET" ? "SET" :
        (["DRIVER", "FAIRWAY_WOOD", "HYBRID", "IRON", "WEDGE", "PUTTER"] as const).find((family) =>
          focusedProduct.category?.toUpperCase().includes(family.replace("_", " ")) || focusedProduct.category?.toUpperCase() === family,
        ) ?? null;
      const alternativeFamilies = familyFromScope ? [familyFromScope] : familyFromProduct ? [familyFromProduct] : [];
      const alternatives = alternativeFamilies.length
        ? await searchCatalogScope({ families: alternativeFamilies, handedness: playerHand })
        : { products: [], error: false };
      const expected = productHand === "RIGHT" ? "diestro" : "zurdo";
      const familyLabel = familyFromScope === "SET" || familyFromProduct === "SET" ? "set completo" : familyFromScope === "DRIVER" || familyFromProduct === "DRIVER" ? "driver" : "producto de esta categoría";
      const reply = `Este ${focusedProduct.name} disponible es para ${expected}, así que no te serviría si juegas ${playerHand === "LEFT" ? "zurdo" : "diestro"}. ${alternatives.products.length ? `Encontré ${alternatives.products.length} alternativa${alternatives.products.length === 1 ? "" : "s"} de ${familyLabel}.` : `Revisé el inventario y ahora mismo no tengo otro ${familyLabel} para ${playerHand === "LEFT" ? "zurdo" : "diestro"} disponible.`}`;
      const state: ConversationState = {
        ...updatedState,
        session: { ...updatedState.session, diagnosticAnswers: answers },
        messages: [...updatedState.messages, { role: "user", content: input.message }, { role: "assistant", content: reply }],
        pendingQuestionKey: null,
        pendingQuestionCategory: null,
        pendingQuestionSlotType: null,
        lastFocusedProduct: focusedProduct,
        productAdvice: { active: false, product: focusedProduct, pendingQuestionKey: null, collectedAnswers: answers },
        participants,
        catalogSearchOutcome: alternatives.products.length ? "RESULTS_FOUND" : "NO_COMPATIBLE_INVENTORY",
        compatibilityOutcome: "HARD_INCOMPATIBLE",
        lastExecutedAction: "RETURN_HARD_INCOMPATIBILITY",
      };
      recordAdviceTelemetry(state, "HARD_INCOMPATIBLE", true);
      return { state, reply, nextQuestion: null, objection: null, events: ["PRODUCT_ADVICE_HARD_INCOMPATIBILITY"], recommendation: null, catalogProducts: alternatives.products, outcome: null, intent: "PRODUCT_ADVICE" as const };
    }
    const experience = Boolean(answers.setExperience) || (!interpretation && /primer set|primera vez|apenas empie|principiante|ya juego|juego actualmente|reemplaz/.test(normalizedMessage));
    if (experience) answers.experience = normalizedMessage;
    const knownExperience = Boolean(answers.setExperience || answers.experience);
    const knownLevel = Boolean(answers.handicapIndex !== undefined || answers.handicap !== undefined || answers.handicapStatus || answers.skill);
    const family = canonicalProductFamily(focusedProduct);
    const experienceRequired = family === "SET";
    const materialQuestion = getNextProductAdviceQuestion({ answers, productFamily: family });
    if (knownLevel && knownHand && (!experienceRequired || knownExperience) && !materialQuestion) {
      const alternatives = await comparableAlternatives({
        product: focusedProduct,
        family,
        handedness: answers.handedness === "LEFT" || answers.handedness === "RIGHT" ? answers.handedness : undefined,
      });
      const isAdvancedEntrySet = family === "SET" && answers.skill === "ADVANCED" && focusedProduct.targetPlayerLevel === "BEGINNER";
      const productLoft = family === "WEDGE" ? Number(focusedProduct.name.match(/(\d{2})\s*°/)?.[1] ?? NaN) : NaN;
      const currentLofts = Array.isArray(answers.currentWedgeLofts) ? answers.currentWedgeLofts : [];
      const complementsSixty = family === "WEDGE" && productLoft === 56 && currentLofts.includes(60);
      const wedgeReason = complementsSixty
        ? "tu 60° cubre los golpes más altos y cortos; este 56° normalmente puede darte un escalón de más distancia y cerrar ese espacio"
        : "su papel en el juego corto y el espacio de loft que puede cubrir";
      const reason = family === "WEDGE" ? wedgeReason : family === "DRIVER"
        ? "su función desde el tee y el objetivo de distancia que me indicaste"
        : safeFamilyLanguage(focusedProduct);
      const caveat = complementsSixty && currentLofts.length < 2
        ? "Antes de decirte que es la combinación ideal, revisaría si llevas un 52°, 54° u otro loft intermedio."
        : null;
      const comparison = alternatives.products.length === 0
        ? `Ahora mismo no tengo otro ${familyLabel(family)} comparable disponible; si quieres seguir con este, estás en la ficha correcta.`
        : alternatives.products.length === 1
          ? `También tengo una alternativa comparable de ${familyLabel(family)}: ${alternatives.products[0].name}.`
          : `También tengo ${alternatives.products.length} alternativas comparables de ${familyLabel(family)}.`;
      const reply = isAdvancedEntrySet
        ? `Te puede servir técnicamente, pero no sería mi primera recomendación para tu perfil. ${focusedProduct.name} está orientado a quien empieza o busca un paquete completo sencillo; con Handicap Index ${answers.handicapIndex}, probablemente aprovecharías mejor un equipo más específico. ${comparison}`
        : `Sí, te lo recomendaría con la información que me diste: ${reason}.${caveat ? ` ${caveat}` : ""} ${comparison}`;
      const state: ConversationState = {
        ...updatedState,
        session: { ...updatedState.session, diagnosticAnswers: answers },
        messages: [...updatedState.messages, { role: "user", content: input.message }, { role: "assistant", content: reply }],
        pendingQuestionKey: null,
        pendingQuestionCategory: null,
        pendingQuestionSlotType: null,
        lastFocusedProduct: focusedProduct,
        productAdvice: { active: false, product: focusedProduct, pendingQuestionKey: null, collectedAnswers: answers },
        activeAdvice: { productId: focusedProduct.id, productFamily: family, status: "CONCLUDED", outcome: isAdvancedEntrySet || caveat ? "RECOMMENDED_WITH_CAVEAT" : "RECOMMENDED" },
        compatibilityOutcome: "MATCH",
        lastExecutedAction: "RETURN_ADVICE_WITH_CAVEAT",
      };
      lastInterpreterTelemetry.currentProductId = focusedProduct.id;
      lastInterpreterTelemetry.comparableAlternativeIds = alternatives.products.map((product) => product.id);
      lastInterpreterTelemetry.comparableAlternativeCount = alternatives.products.length;
      lastInterpreterTelemetry.comparisonEligible = true;
      lastInterpreterTelemetry.comparisonOffered = alternatives.products.length > 0;
      lastInterpreterTelemetry.technicalCompatibility = "MATCH";
      lastInterpreterTelemetry.playerLevelFit = isAdvancedEntrySet ? "CAVEAT" : "MATCH";
      lastInterpreterTelemetry.targetPlayerLevel = focusedProduct.targetPlayerLevel ?? "UNKNOWN";
      lastInterpreterTelemetry.recommendationStrength = isAdvancedEntrySet || caveat ? "CONDITIONAL" : "STRONG";
      recordAdviceTelemetry(state, isAdvancedEntrySet || caveat ? "RECOMMENDED_WITH_CAVEAT" : "RECOMMENDED", true);
      return { state, reply, nextQuestion: null, objection: null, events: ["PRODUCT_ADVICE_COMPLETED"], recommendation: null, outcome: null, intent: "PRODUCT_ADVICE" as const };
    }
    const nextAdviceQuestion = materialQuestion;
    const resolvedQuestion = nextAdviceQuestion && resolvedFactKeysThisTurn.has(nextAdviceQuestion.key) ? null : nextAdviceQuestion;
    const semanticFingerprint = JSON.stringify({ answers, product: focusedProduct.id, resolved: [...resolvedFactKeysThisTurn].sort() });
    const previousLoop = updatedState.conversationLoop ?? { lastQuestionKey: null, consecutiveSameQuestionCount: 0, lastSemanticFingerprint: null };
    const repeatedWithoutProgress = previousLoop.lastQuestionKey === resolvedQuestion?.key && previousLoop.lastSemanticFingerprint === semanticFingerprint;
    const nextLoop = {
      lastQuestionKey: resolvedQuestion?.key ?? null,
      consecutiveSameQuestionCount: repeatedWithoutProgress ? previousLoop.consecutiveSameQuestionCount + 1 : 0,
      lastSemanticFingerprint: semanticFingerprint,
    };
    const playerLabel = participants.player.relationToBuyer === "SELF" ? "tu" : `${participants.player.displayReference}`;
    const invalidWedgeLoftAnswer = pendingKey === "currentWedgeLofts" && !answeredPending && input.message.trim().length > 0;
    const semanticQuestion = invalidWedgeLoftAnswer
      ? "Necesito los lofts, no una distancia: indícamelos como 50°, 54° y 58°; si sólo conoces una medida, dime el loft exacto."
      : questionPromptFor(resolvedQuestion, playerPerspective, focusedProduct.category);
    if (invalidWedgeLoftAnswer) {
      lastInterpreterTelemetry.loopPrevented = true;
      lastInterpreterTelemetry.loopReason = "INVALID_WEDGE_LOFT_FORMAT";
    }
    const reply = repeatedWithoutProgress
      ? "Para no hacerte repetir la misma pregunta, puedo continuar con una recomendación general o puedes indicarme qué dato prefieres compartir."
      : asksData
      ? knownHand
        ? `Para evaluar ${focusedProduct.name}, ya sé que ${participants.player.relationToBuyer === "SELF" ? "juegas" : `${participants.player.displayReference} juega`} ${answers.handedness === "LEFT" ? "zurdo" : "diestro"}. El siguiente dato material es: ${semanticQuestion ?? "puedo continuar con la información disponible."}`
        : `Para evaluar ${focusedProduct.name}, empecemos por el siguiente dato material: ${semanticQuestion ?? `¿${playerLabel} juega como diestro o zurdo?`}`
      : semanticQuestion
        ? `Perfecto. Para orientarte mejor con ${focusedProduct.name}, ${semanticQuestion}`
        : `Perfecto. Con estos datos ya puedo orientarte sobre ${focusedProduct.name}.`;
    const state: ConversationState = {
      ...updatedState,
      session: { ...updatedState.session, diagnosticAnswers: answers },
      messages: [...updatedState.messages, { role: "user", content: input.message }, { role: "assistant", content: reply }],
      pendingQuestionKey: resolvedQuestion?.key ?? null,
      pendingQuestionCategory: "PRODUCT_ADVICE",
      pendingQuestionSlotType: resolvedQuestion && ["skill", "handicap", "handicapIndex"].includes(resolvedQuestion.key) ? "HANDICAP" : resolvedQuestion?.key === "setExperience" ? "BOOLEAN_PREFERENCE" : resolvedQuestion ? "HANDEDNESS" : null,
      lastFocusedProduct: focusedProduct,
      productAdvice: { active: Boolean(resolvedQuestion), product: focusedProduct, pendingQuestionKey: resolvedQuestion?.key ?? null, collectedAnswers: answers },
      activeAdvice: resolvedQuestion ? { productId: focusedProduct.id, productFamily: canonicalProductFamily(focusedProduct), status: "NEEDS_ONE_MORE_FACT" } : updatedState.activeAdvice,
      pendingAssistantOffer: null,
      participants,
      conversationLoop: nextLoop,
    };
    recordAdviceTelemetry(state, null, false, resolvedQuestion ? [resolvedQuestion.key] : []);
    return { state, reply, nextQuestion: null, objection: null, events: ["PRODUCT_ADVICE_PROGRESS"], recommendation: null, outcome: null, intent: "PRODUCT_ADVICE" as const };
  }
  if (isCatalogIntent(intent)) {
    const requestedHand = updatedState.session.diagnosticAnswers.handedness;
    const scopeFamilies = updatedState.searchScope?.families ?? (interpretation?.category ? [interpretation.category] : []);
    if (interpretation?.catalogScopeIntent === "ALL_HANDED_EQUIPMENT" && requestedHand !== "LEFT" && requestedHand !== "RIGHT") {
      const reply = "Para mostrarte opciones adecuadas para zurdos o diestros necesito confirmar la mano de juego. ¿Juegas como diestro o zurdo?";
      const state: ConversationState = {
        ...updatedState,
        messages: [...updatedState.messages, { role: "user", content: input.message }, { role: "assistant", content: reply }],
        pendingQuestionKey: "handedness",
        pendingQuestionCategory: "PRODUCT_ADVICE",
        pendingQuestionSlotType: "HANDEDNESS",
        lastExecutedAction: "ASK_NEXT_QUESTION",
      };
      return { state, reply, nextQuestion: null, objection: null, events: ["HANDEDNESS_REQUIRED_FOR_BROAD_SEARCH"], recommendation: null, outcome: null, catalogProducts: [], intent };
    }
    const familyLabels: Record<string, string> = {
      DRIVER: "drivers",
      FAIRWAY_WOOD: "maderas de calle",
      HYBRID: "híbridos",
      IRON: "hierros",
      WEDGE: "wedges",
      PUTTER: "putters",
      SET: "sets completos",
    };
    const catalog = scopeFamilies.length > 0
      ? await searchCatalogScope({
          families: scopeFamilies,
          handedness: requestedHand === "LEFT" || requestedHand === "RIGHT" ? requestedHand : undefined,
        }).then((result) => {
          const labels = scopeFamilies.map((family) => familyLabels[family] ?? family.toLowerCase());
          const scopeLabel = labels.length > 1 ? `${labels.slice(0, -1).join(", ")} y ${labels.at(-1)}` : labels[0];
          const handLabel = requestedHand === "LEFT" ? " para zurdo" : requestedHand === "RIGHT" ? " para diestro" : "";
          const availabilityLabel = result.products.length === 1 ? "1 opción disponible" : `${result.products.length} opciones disponibles`;
          return {
            products: result.products,
            error: result.error,
            message: result.products.length
              ? `Encontré ${availabilityLabel}${handLabel}.`
              : `Ahora mismo no tengo ${scopeLabel}${handLabel} disponibles.`,
          };
        })
      : await searchCommercialCatalog(input.message);
    const reply = catalog.message;
    const references: CatalogProductReference[] = catalog.products.map((product) => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      category: product.categoryName,
      condition: product.condition,
      price: product.price,
      productHref: `/productos/${encodeURIComponent(product.slug)}`,
      imagePath: product.images[0]?.storagePath ?? null,
      handedness: product.handedness,
      family: product.productFamily,
      targetPlayerLevel: targetLevelForSet(product),
    }));
    const currentResultIds = new Set(references.map((product) => product.id));
    const retainedInteraction = updatedState.lastInteractedProduct &&
      (currentResultIds.has(updatedState.lastInteractedProduct.id) || pageProductReference?.id === updatedState.lastInteractedProduct.id)
      ? updatedState.lastInteractedProduct
      : null;
    const nextFocusedProduct = references.length === 1
      ? references[0]
      : retainedInteraction && currentResultIds.has(retainedInteraction.id)
        ? retainedInteraction
        : null;
    const nextReferenceResolution = resolveProductReference({
      currentPageProduct: pageProductReference,
      lastInteractedProduct: retainedInteraction,
      focusedProduct: nextFocusedProduct,
      recentResults: references,
      explicitProduct: null,
    });
    const state: ConversationState = {
      ...updatedState,
      messages: [
        ...updatedState.messages,
        { role: "user", content: input.message },
        { role: "assistant", content: reply },
      ],
      pendingQuestionKey: null,
      pendingQuestionCategory: null,
      pendingQuestionSlotType: null,
      lastCatalogResults: references,
      lastFocusedProduct: nextFocusedProduct,
      lastInteractedProduct: retainedInteraction,
      focusedProductSource: nextReferenceResolution.source === "CURRENT_PAGE"
        ? "CURRENT_PAGE"
        : nextReferenceResolution.source === "PRODUCT_CARD_CLICK"
          ? "PRODUCT_CARD_CLICK"
          : nextReferenceResolution.source === "UNIQUE_RECENT_RESULT"
            ? "UNIQUE_RECENT_RESULT"
            : nextReferenceResolution.source === "FOCUSED_CONTEXT"
              ? updatedState.focusedProductSource
              : null,
      referenceResolution: {
        productId: nextReferenceResolution.productId,
        source: nextReferenceResolution.source,
      },
      productAdvice: { active: false, product: null, pendingQuestionKey: null, collectedAnswers: {} },
      pendingAssistantOffer: null,
      catalogSearchOutcome: catalog.products.length > 0
        ? "RESULTS_FOUND"
        : requestedHand === "LEFT" || requestedHand === "RIGHT"
          ? "NO_COMPATIBLE_INVENTORY"
          : "NO_INVENTORY",
      lastExecutedAction: catalog.products.length > 0 ? "SHOW_CATALOG_RESULTS" : "RETURN_NO_COMPATIBLE_INVENTORY",
    };
    return {
      state,
      reply,
      nextQuestion: null,
      objection: null,
      events: ["COMMERCIAL_CATALOG_SEARCH"],
      recommendation: null,
      catalogProducts: catalog.products,
      outcome: null,
      error: catalog.error ? ("CATALOG_UNAVAILABLE" as const) : null,
      intent,
    };
  }
  const hints = interpretation
    ? [
        interpretation.category ?? "",
        ...interpretation.declaredFacts.map(
          (fact) => `${fact.field} ${fact.value}`,
        ),
        ...interpretation.temporaryPreferences,
        interpretation.objection ?? "",
      ].join(" ")
    : "";
  const turn = classifyConversationTurn(
    updatedState,
    `${input.message} ${hints}`,
    context.profile,
    playerPerspective,
    { allowDeterministicFallback: !interpretation },
  );
  const policyTurn = turn;
  // A direct recommendation request is an action, not another diagnostic turn.
  // Execute the existing deterministic pipeline immediately when a category is active.
  // Complete sets are a catalog/product-family flow; the club-only Match
  // engine deliberately does not accept SET and would throw RangeError.
  if (
    (!turn.nextQuestion || requestsRecommendation) &&
    turn.state.session.requestedCategory &&
    turn.state.session.requestedCategory !== "SET"
  ) {
    const inventory = await loadInventoryUnits();
    if (inventory.error)
      return {
        ...turn,
        reply:
          "No pude validar el inventario en este momento. Intenta nuevamente en unos segundos.",
        recommendation: null,
        outcome: null,
        error: "INVENTORY_UNAVAILABLE" as const,
      };
    const category = normalizeMatchCategory(
      turn.state.session.requestedCategory,
    );
    const units = inventory.data.filter((unit) => {
      try {
        return normalizeMatchCategory(unit.category) === category;
      } catch {
        return false;
      }
    });
    const candidates = matchInventoryCandidates({
      golfer: participants.player.relationToBuyer === "SELF" ? context.profile : null,
      currentEquipment: context.equipment,
      objectives: context.objectives,
      units,
    });
    const answers = turn.state.session.diagnosticAnswers;
    const preferences: RankingPreferences = {
      budgetMxnMinor: turn.state.session.budgetMxnMinor,
      purchaseIntent:
        turn.state.session.purchaseIntent === "BUY_NOW"
          ? "BUY_NOW"
          : "EXPLORING",
      preferredBrands: typeof answers.brand === "string" ? [answers.brand] : [],
      conditionPreference:
        answers.conditionPreference === "NEW_ONLY"
          ? "NEW_ONLY"
          : answers.conditionPreference === "USED_ACCEPTABLE"
            ? "USED_ACCEPTABLE"
            : "UNKNOWN",
    };
    const recommendation = rankInventoryCandidates(candidates, preferences);
    const outcomeType: ConversationOutcome =
      recommendation.status === "RECOMMENDATIONS"
        ? "RECOMMENDATIONS_AVAILABLE"
        : units.length === 0
          ? "NO_INVENTORY"
          : "NO_RESPONSIBLE_MATCH";
    const priceChoice =
      turn.objection === "PRICE" && recommendation.status === "RECOMMENDATIONS"
        ? recommendation.recommendations.filter(
            (item) =>
              item.role === "BEST_OPTION" ||
              item.role === "BEST_VALUE" ||
              item.role === "ALTERNATIVE",
          )
        : null;
    let reply =
      turn.objection === "PRICE"
        ? priceObjectionReply(
            Boolean(priceChoice?.some((item) => item.role === "BEST_VALUE")),
            Boolean(priceChoice?.some((item) => item.role === "ALTERNATIVE")),
          )
        : recommendationReply(recommendation);
    if (outcomeType !== "RECOMMENDATIONS_AVAILABLE" && turn.objection !== "PRICE")
      reply = terminalOutcomeMessage(
        outcomeType,
        category,
            typeof turn.state.session.diagnosticAnswers.handedness === "string" ? turn.state.session.diagnosticAnswers.handedness : null,
      );
    const safeRecommendation =
      priceChoice && priceChoice.length > 1
        ? {
            ...recommendation,
            recommendations: [priceChoice[0], priceChoice[1]].map(
              (item, index) => ({
                ...item,
                rank: index + 1,
                role: index === 0 ? ("BEST_OPTION" as const) : item.role,
              }),
            ),
          }
        : recommendation;
    if (
      provider &&
      outcomeType === "RECOMMENDATIONS_AVAILABLE" &&
      turn.objection !== "PRICE"
    ) {
      try {
        const generated = await provider.explainRecommendation({
          productFamilyContext: (turn.state.session.requestedCategory as "SET" | "DRIVER" | "FAIRWAY_WOOD" | "HYBRID" | "IRON" | "WEDGE" | "PUTTER" | null) ?? null,
          session: {
            category: turn.state.session.requestedCategory,
            intent: turn.state.session.purchaseIntent,
            budgetKnown: turn.state.session.budgetMxnMinor !== null,
            knownFacts: Object.keys(turn.state.session.diagnosticAnswers),
          },
          userTurn: input.message,
          nextQuestionKey: null,
          hasBestValue:
            recommendation.status === "RECOMMENDATIONS" &&
            recommendation.recommendations.some(
              (item) => item.role === "BEST_VALUE",
            ),
          hasAlternative:
            recommendation.status === "RECOMMENDATIONS" &&
            recommendation.recommendations.some(
              (item) => item.role === "ALTERNATIVE",
            ),
          hasCheaperResponsibleOption: Boolean(
            priceChoice && priceChoice.length > 1,
          ),
          recommendation: safeRecommendationPayload(safeRecommendation),
        });
        if (generated.trim()) reply = generated.trim();
      } catch {
        // Keep the deterministic response if the conversational provider fails.
      }
    }
    const outcome: ConversationOutcomeResult = {
      type: outcomeType,
      message: reply,
    };
    return withFinalReply({
      ...policyTurn,
      reply,
      recommendation: safeRecommendation,
      outcome,
      error: null,
      providerUsed: Boolean(provider),
    });
  }
  const terminalOutcome = {
        type: "INSUFFICIENT_DATA" as const,
        message: terminalOutcomeMessage(
          "INSUFFICIENT_DATA",
          turn.state.session.requestedCategory ?? "equipment",
          typeof turn.state.session.diagnosticAnswers.handedness === "string" ? turn.state.session.diagnosticAnswers.handedness : null,
        ),
      } satisfies ConversationOutcomeResult;
  const outcome = policyTurn.nextQuestion ? null : terminalOutcome;
  const reply = policyTurn.nextQuestion ? policyTurn.reply : terminalOutcome.message;
  return withFinalReply({
    ...policyTurn,
    reply,
    recommendation: null,
    outcome,
    error: null,
  });
}
