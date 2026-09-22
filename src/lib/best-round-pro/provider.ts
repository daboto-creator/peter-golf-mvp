import "server-only";

import { z } from "zod";

import { serverEnv } from "@/env/server";
import {
  CURRENT_TURN_FACT_SOURCES,
  DIALOGUE_ACT_CONTRACT,
  DIALOGUE_ACTS,
  FACT_MUTATION_INTENTS,
  SEARCH_SCOPE_MODE_CONTRACT,
  SEARCH_SCOPE_MODES,
} from "@/lib/best-round-pro/contract";
import type { CommercialRankingResult } from "@/lib/recommendations/commercial-ranking";

const factSchema = z.object({
  field: z.enum([
    "handedness",
    "handicap",
    "handicapIndex",
    "handicapStatus",
    "shotTendency",
    "objective",
    "brand",
    "conditionPreference",
    "swingSpeed",
    "setExperience",
    "skill",
    "purchaseTarget",
    "relationship",
  ]),
  value: z.union([z.string(), z.number()]),
  durable: z.boolean(),
  semanticStatus: z.enum(["KNOWN", "UNKNOWN", "NONE", "NOT_APPLICABLE", "DECLINED"]).default("KNOWN"),
  source: z.enum(CURRENT_TURN_FACT_SOURCES).default("CONTEXT_INFERRED"),
}).superRefine((fact, ctx) => {
  if (fact.field === "handicapIndex" && (typeof fact.value !== "number" || fact.value < 0 || fact.value > 54))
    ctx.addIssue({ code: "custom", path: ["value"], message: "handicapIndex must be between 0 and 54" });
});
export const conversationInterpretationSchema = z.object({
  dialogueAct: z.enum(DIALOGUE_ACTS),
  intent: z.enum(["BUY_NOW", "EXPLORING", "ACTIVE_RESEARCH", "UNKNOWN"]),
  category: z
    .enum(["DRIVER", "FAIRWAY_WOOD", "HYBRID", "IRON", "WEDGE", "PUTTER", "SET"])
    .nullable(),
  requestedProductFamilies: z.array(z.enum(["DRIVER", "FAIRWAY_WOOD", "HYBRID", "IRON", "WEDGE", "PUTTER", "SET"])).max(6).default([]),
  searchScopeMode: z.enum(SEARCH_SCOPE_MODES).nullable().default(null),
  catalogScopeIntent: z.enum(["EXPLICIT_FAMILIES", "INHERIT_PREVIOUS_FAMILY", "ALL_CLUBS", "ALL_HANDED_EQUIPMENT", "ALL_EQUIPMENT"]).nullable().default(null),
  searchContinuationRelation: z.enum(["KEEP_SCOPE", "BROADEN_SCOPE", "REPLACE_SCOPE"]).nullable().default(null),
  searchContinuationReason: z.enum(["EXPLICIT_CURRENT_TURN", "ELLIPTICAL_CONTINUATION", "PREVIOUS_SCOPE_EXHAUSTED"]).nullable().default(null),
  productReference: z.string().max(120).nullable(),
  reasonMode: z.enum(["CATALOG_REASON", "PERSONAL_FIT_REASON"]).nullable().default(null),
  declaredFacts: z.array(factSchema).max(8),
  factMutationIntent: z.enum(FACT_MUTATION_INTENTS).default("NONE"),
  temporaryPreferences: z.array(z.string().max(80)).max(8),
  objection: z
    .enum([
      "PRICE",
      "UNCERTAIN_FIT",
      "BRAND",
      "NEW_VS_USED",
      "NEED_TO_THINK",
      "WANT_OTHER_OPTION",
    ])
    .nullable(),
  wantsRecommendation: z.boolean(),
  wantsHandoff: z.boolean(),
  answersPendingQuestion: z.boolean().default(false),
  asksForExplanation: z.boolean().default(false),
  asksWhatInformationNeeded: z.boolean().default(false),
  topicChanged: z.boolean().default(false),
  confidence: z.number().min(0).max(1).default(1),
  entities: z.object({
    purchaseTarget: z.enum(["SELF", "OTHER_PERSON"]).default("SELF"),
    relationship: z.enum(["SPOUSE", "CHILD", "FRIEND", "OTHER", "UNKNOWN"]).default("UNKNOWN"),
    playerReference: z.string().nullable().default(null),
  }).default({ purchaseTarget: "SELF", relationship: "UNKNOWN", playerReference: null }),
});
export type ConversationInterpretation = z.infer<typeof conversationInterpretationSchema> & {
  rawDialogueAct?: string | null;
};

export function normalizeInterpretationShape(raw: unknown) {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const entities = value.entities && typeof value.entities === "object"
    ? value.entities as Record<string, unknown>
    : {};
  const category = value.category === "COMPLETE_SET" || value.category === "COMPLETE SET" || value.category === "SETS"
    ? "SET"
    : value.category ?? null;
  const dialogueAliases: Record<string, string> = {
    ANSWER_PENDING: "ANSWER_PENDING_QUESTION",
    ANSWER_PENDING_SLOT: "ANSWER_PENDING_QUESTION",
    ANSWER: "ANSWER_PENDING_QUESTION",
    PRODUCT_SELECTION: "PRODUCT_ADVICE",
    SELECT_PRODUCT: "PRODUCT_ADVICE",
    ASK_SET_EXPERIENCE: "OTHER",
    ASK_PLAYER_SKILL_LEVEL: "OTHER",
    ASK_HANDEDNESS: "OTHER",
    ASK_PLAYER_HANDEDNESS: "OTHER",
    ASK_GAPPING: "OTHER",
    ASK_SWING_SPEED: "OTHER",
  };
  const rawDialogueAct = value.dialogueAct;
  const catalogScopeIntent = value.catalogScopeIntent ?? null;
  // Repair the one known provider concept collision without making
  // ALL_HANDED_EQUIPMENT a search-scope mode. Handedness remains an intent;
  // the runtime scope that covers sets and individual clubs is ALL_EQUIPMENT.
  const searchScopeMode = value.searchScopeMode === "ALL_HANDED_EQUIPMENT" && catalogScopeIntent === "ALL_HANDED_EQUIPMENT"
    ? "ALL_EQUIPMENT"
    : value.searchScopeMode ?? null;
  return {
    dialogueAct: typeof rawDialogueAct === "string" ? dialogueAliases[rawDialogueAct] ?? rawDialogueAct : rawDialogueAct,
    intent: value.intent ?? "UNKNOWN",
    category,
    requestedProductFamilies: Array.isArray(value.requestedProductFamilies) ? value.requestedProductFamilies : [],
    searchScopeMode,
    catalogScopeIntent,
    searchContinuationRelation: value.searchContinuationRelation ?? null,
    searchContinuationReason: value.searchContinuationReason ?? null,
    productReference: value.productReference ?? null,
    reasonMode: value.reasonMode ?? null,
    declaredFacts: Array.isArray(value.declaredFacts)
      ? value.declaredFacts.map((fact) => fact && typeof fact === "object"
        ? { ...(fact as Record<string, unknown>), source: (fact as Record<string, unknown>).source ?? "CONTEXT_INFERRED" }
        : fact)
      : [],
    factMutationIntent: value.factMutationIntent ?? "NONE",
    temporaryPreferences: Array.isArray(value.temporaryPreferences) ? value.temporaryPreferences : [],
    objection: value.objection ?? null,
    wantsRecommendation: value.wantsRecommendation ?? false,
    wantsHandoff: value.wantsHandoff ?? false,
    answersPendingQuestion: value.answersPendingQuestion ?? false,
    asksForExplanation: value.asksForExplanation ?? false,
    asksWhatInformationNeeded: value.asksWhatInformationNeeded ?? false,
    topicChanged: value.topicChanged ?? false,
    confidence: typeof value.confidence === "number" ? value.confidence : 0.5,
    entities: {
      purchaseTarget: entities.purchaseTarget ?? "SELF",
      relationship: entities.relationship ?? "UNKNOWN",
      playerReference: entities.playerReference ?? null,
    },
  };
}

export class ConversationProviderError extends Error {
  constructor(
    message: string,
    readonly diagnostics: {
      httpStatus?: number;
      timedOut?: boolean;
      jsonParsed?: boolean;
      validationIssues?: Array<{
        field: string;
        path: string;
        code: string;
        expected?: string;
        received?: string;
        receivedValue?: string | number | boolean | null;
      }>;
    } = {},
  ) {
    super(message);
    this.name = "ConversationProviderError";
  }
}

function safeScalarAtPath(value: unknown, path: PropertyKey[]) {
  let current = value;
  for (const segment of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<PropertyKey, unknown>)[segment];
  }
  return current === null || ["string", "number", "boolean"].includes(typeof current)
    ? current as string | number | boolean | null
    : undefined;
}

export function providerValidationIssues(raw: unknown) {
  const normalized = normalizeInterpretationShape(raw);
  const result = conversationInterpretationSchema.safeParse(normalized);
  if (result.success) return [];
  return result.error.issues.map((issue) => {
    const field = issue.path.join(".");
    return {
      field,
      path: field,
      code: issue.code,
      expected: "expected" in issue ? String(issue.expected) : undefined,
      received: "received" in issue ? String(issue.received) : undefined,
      receivedValue: safeScalarAtPath(normalized, issue.path),
    };
  }).slice(0, 12);
}

export type SafeConversationPayload = {
  productFamilyContext?: "SET" | "DRIVER" | "FAIRWAY_WOOD" | "HYBRID" | "IRON" | "WEDGE" | "PUTTER" | null;
  session: {
    category: string | null;
    targetCategory?: string | null;
    intent: string;
    budgetKnown: boolean;
    knownFacts: string[];
  };
  userTurn: string;
  conversationContext?: {
    recentTurns: Array<{ role: "user" | "assistant"; content: string }>;
    focusedProduct: { name: string; family: string | null } | null;
    currentPageProduct?: { id: string; name: string; family: string | null } | null;
    lastInteractedProduct?: { id: string; name: string; family: string | null } | null;
    activeAdvice: boolean;
    previousSearchFamilies?: string[];
    previousSearchOutcome?: string | null;
    lastExecutedAction?: string | null;
    participantContext?: { relationToBuyer: string; displayReference: string };
    pendingQuestion?: {
      key: string;
      meaning: string;
      targetEntity: "PLAYER" | "BUYER";
      expectedValues: string[];
      allowedStatuses: string[];
    } | null;
    pendingAssistantOffer?: {
      action: string;
      targetProducts: Array<{ id: string; name: string; family: string | null }>;
    } | null;
  };
  nextQuestionKey: string | null;
  pendingQuestionSlotType?: string | null;
  hasBestValue?: boolean;
  hasAlternative?: boolean;
  hasCheaperResponsibleOption?: boolean;
  recommendation:
    | null
    | {
        role: string;
        brand: string | null;
        model: string | null;
        priceMxnMinor: number | null;
        condition: string | null;
        matchScore: number;
        confidence: string;
        reasons: string[];
      }[];
};

export interface BestRoundConversationProvider {
  interpretTurn(
    payload: Pick<
      SafeConversationPayload,
      "session" | "userTurn" | "nextQuestionKey" | "pendingQuestionSlotType" | "conversationContext"
    >,
  ): Promise<ConversationInterpretation>;
  explainRecommendation(payload: SafeConversationPayload): Promise<string>;
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  return fenced ?? text;
}

class OpenAICompatibleProvider implements BestRoundConversationProvider {
  private async complete(system: string, user: unknown) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(
        `${serverEnv.BEST_ROUND_PRO_LLM_BASE_URL}/chat/completions`,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${serverEnv.BEST_ROUND_PRO_LLM_API_KEY}`,
          },
          body: JSON.stringify({
            model: serverEnv.BEST_ROUND_PRO_LLM_MODEL,
            temperature: 0,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: system },
              { role: "user", content: JSON.stringify(user) },
            ],
          }),
        },
      );
      if (!response.ok)
        throw new ConversationProviderError(`llm_${response.status}`, {
          httpStatus: response.status,
        });
      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = body.choices?.[0]?.message?.content;
      if (!content) throw new ConversationProviderError("llm_empty", { jsonParsed: false });
      return content;
    } finally {
      clearTimeout(timeout);
    }
  }
  async interpretTurn(
    payload: Pick<
      SafeConversationPayload,
      "session" | "userTurn" | "nextQuestionKey" | "pendingQuestionSlotType" | "conversationContext"
    >,
  ) {
    const system = `Eres Best Round Pro. Analiza exclusivamente el MENSAJE ACTUAL DEL USUARIO y devuelve JSON. dialogueAct describe la intención del usuario y sólo puede ser ${DIALOGUE_ACT_CONTRACT}. Nunca uses acciones del planificador como ASK_SET_EXPERIENCE, ASK_PLAYER_SKILL_LEVEL, ASK_HANDEDNESS, ASK_GAPPING o ASK_SWING_SPEED como dialogueAct. Contrato: { dialogueAct, intent: BUY_NOW|EXPLORING|ACTIVE_RESEARCH|UNKNOWN, category: DRIVER|FAIRWAY_WOOD|HYBRID|IRON|WEDGE|PUTTER|SET|null, requestedProductFamilies: array, searchScopeMode: ${SEARCH_SCOPE_MODE_CONTRACT}|null, catalogScopeIntent: EXPLICIT_FAMILIES|INHERIT_PREVIOUS_FAMILY|ALL_CLUBS|ALL_HANDED_EQUIPMENT|ALL_EQUIPMENT|null, searchContinuationRelation: KEEP_SCOPE|BROADEN_SCOPE|REPLACE_SCOPE|null, searchContinuationReason: EXPLICIT_CURRENT_TURN|ELLIPTICAL_CONTINUATION|PREVIOUS_SCOPE_EXHAUSTED|null, productReference: string|null, reasonMode: CATALOG_REASON|PERSONAL_FIT_REASON|null, declaredFacts: array, factMutationIntent: NONE|SET_NEW|CORRECT_EXISTING, temporaryPreferences: array, objection: PRICE|UNCERTAIN_FIT|BRAND|NEW_VS_USED|NEED_TO_THINK|WANT_OTHER_OPTION|null, wantsRecommendation: boolean, wantsHandoff: boolean, answersPendingQuestion: boolean, asksForExplanation: boolean, asksWhatInformationNeeded: boolean, topicChanged: boolean, confidence: number, entities }. declaredFacts contiene únicamente hechos comunicados nuevamente por el MENSAJE ACTUAL, nunca hechos copiados del contexto. Cada hecho es {field, value, durable, semanticStatus, source}, donde source es CURRENT_USER_EXPLICIT, CURRENT_USER_PENDING_ANSWER, CURRENT_USER_CORRECTION o CONTEXT_INFERRED. Omite hechos que sólo vengan del contexto. Usa factMutationIntent=SET_NEW para hechos nuevos explícitos, CORRECT_EXISTING sólo cuando el usuario corrige explícitamente un hecho previo, y NONE si no comunica hechos. Si responde pendingQuestion, usa dialogueAct=ANSWER_PENDING_QUESTION, answersPendingQuestion=true, source=CURRENT_USER_PENDING_ANSWER y el valor canónico indicado. 'ya juego', 'ya tengo equipo', 'llevo tiempo jugando' y 'no es mi primer set' significan setExperience=CURRENT_PLAYER. Si pendingQuestion es handicapIndex, un número entre 0 y 54 significa handicapIndex y handicapStatus=KNOWN; 'no tengo handicap' significa handicapStatus=NONE y 'no sé' UNKNOWN. No preguntes skill si el handicap está pendiente o ya está resuelto. 'qué tienes para zurdo' es CATALOG_SEARCH, catalogScopeIntent=ALL_HANDED_EQUIPMENT, searchScopeMode=ALL_EQUIPMENT y handedness=LEFT/KNOWN/CURRENT_USER_EXPLICIT. Los valores conocidos canónicos incluyen handedness RIGHT|LEFT y setExperience FIRST_SET|CURRENT_PLAYER. No inventes compatibilidad, precio, stock ni ranking.`;
    const providerSchemaDetails = " requestedProductFamilies sólo admite DRIVER|FAIRWAY_WOOD|HYBRID|IRON|WEDGE|PUTTER|SET. Cada declaredFact.field sólo admite handedness|handicap|handicapIndex|handicapStatus|shotTendency|objective|brand|conditionPreference|swingSpeed|setExperience|skill|purchaseTarget|relationship; value es string o number; durable es boolean; semanticStatus es KNOWN|UNKNOWN|NONE|NOT_APPLICABLE|DECLINED. temporaryPreferences es string[]. entities es {purchaseTarget: SELF|OTHER_PERSON, relationship: SPOUSE|CHILD|FRIEND|OTHER|UNKNOWN, playerReference: string|null}. Incluye siempre todos los campos raíz del contrato. pendingQuestion.meaning es metadata del planificador sobre la pregunta anterior; no es un dialogueAct permitido para el usuario.";
    const semanticReasonInstruction = " 'este me sirve' es ASK_PRODUCT_FIT. reasonMode es CATALOG_REASON cuando preguntan por qué apareció un producto y PERSONAL_FIT_REASON cuando preguntan por qué les conviene. Una oferta pendiente seguida de sí/dale/revisemos es CONFIRMATION, sin declarar hechos del jugador. Buscar o mostrar opciones es CATALOG_SEARCH; comparar explícitamente es ASK_COMPARISON. Distingue BUYER y PLAYER.";
    const rawText = await this.complete(system + providerSchemaDetails + semanticReasonInstruction, payload);
    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJson(rawText));
    } catch {
      throw new ConversationProviderError("llm_invalid_json", { jsonParsed: false });
    }
    const normalized = normalizeInterpretationShape(parsed);
    const result = conversationInterpretationSchema.safeParse(normalized);
    if (!result.success) {
      throw new ConversationProviderError("llm_schema_invalid", {
        jsonParsed: true,
        validationIssues: providerValidationIssues(parsed),
      });
    }
    const rawDialogueAct = parsed && typeof parsed === "object" && typeof (parsed as Record<string, unknown>).dialogueAct === "string"
      ? String((parsed as Record<string, unknown>).dialogueAct)
      : null;
    return { ...result.data, rawDialogueAct };
  }
  async explainRecommendation(payload: SafeConversationPayload) {
    const system =
      "Redacta una respuesta breve en español basada exclusivamente en el DTO. Respeta productFamilyContext: nunca uses vocabulario de otra familia (un WEDGE no es un SET, un PUTTER no es un DRIVER). No inventes productos, precios, stock ni descuentos. No menciones costes, margen, comisión ni vendedor. No calcules Match ni ranking. Nunca atribuyas confianza baja a inventario o disponibilidad: sólo usa confidenceReasons entregadas por backend. Respeta targetPlayer y, si no es SELF, no describas sus hechos con tú/tu. Devuelve JSON {text:string}.";
    const result = z
      .object({ text: z.string().max(1200) })
      .parse(JSON.parse(extractJson(await this.complete(system, payload))));
    return result.text;
  }
}

export function getConversationProvider(): BestRoundConversationProvider | null {
  return serverEnv.BEST_ROUND_PRO_LLM_API_KEY
    ? new OpenAICompatibleProvider()
    : null;
}

export function safeRecommendationPayload(
  result: CommercialRankingResult,
): SafeConversationPayload["recommendation"] {
  if (result.status !== "RECOMMENDATIONS") return null;
  return result.recommendations.map((item) => ({
    role: item.role,
    brand: item.candidate.brand,
    model: item.candidate.model,
    priceMxnMinor: item.candidate.priceMxnMinor,
    condition: item.candidate.condition,
    matchScore: item.equipmentMatch.matchScore,
    confidence: item.equipmentMatch.confidence,
    reasons: item.safeReasons,
  }));
}
