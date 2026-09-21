import "server-only";

import { z } from "zod";

import { serverEnv } from "@/env/server";
import {
  SEARCH_SCOPE_MODE_CONTRACT,
  SEARCH_SCOPE_MODES,
} from "@/lib/best-round-pro/contract";
import type { CommercialRankingResult } from "@/lib/recommendations/commercial-ranking";

const factSchema = z.object({
  field: z.enum([
    "handedness",
    "handicap",
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
});
export const conversationInterpretationSchema = z.object({
  dialogueAct: z.enum([
    "CATALOG_SEARCH", "PRODUCT_ADVICE", "ASK_PRODUCT_REASON", "ASK_PRODUCT_DETAILS",
    "ASK_COMPARISON", "ASK_PRODUCT_FIT", "ANSWER_PENDING_QUESTION", "ASK_WHAT_INFORMATION_NEEDED",
    "CHANGE_PRODUCT", "CHANGE_TOPIC", "FITTING_REQUEST", "STORE_QUESTION",
    "GENERAL_GOLF", "CONFIRMATION", "CORRECTION", "GREETING", "THANKS", "GOODBYE", "SMALL_TALK", "HELP_REQUEST", "CLARIFICATION", "USER_FRUSTRATION", "GENERAL_QUESTION", "PRODUCT_DETAILS", "OTHER",
  ]),
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
export type ConversationInterpretation = z.infer<
  typeof conversationInterpretationSchema
>;

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
    declaredFacts: Array.isArray(value.declaredFacts) ? value.declaredFacts : [],
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
    const system =
      `Eres Best Round Pro y debes devolver exactamente este contrato JSON. Interpreta significado, no frases exactas. OUTPUT CONTRACT: { dialogueAct: CATALOG_SEARCH|PRODUCT_ADVICE|ASK_PRODUCT_REASON|ASK_PRODUCT_DETAILS|ASK_PRODUCT_FIT|ASK_COMPARISON|ANSWER_PENDING_QUESTION|ASK_WHAT_INFORMATION_NEEDED|CHANGE_PRODUCT|CHANGE_TOPIC|FITTING_REQUEST|STORE_QUESTION|GENERAL_GOLF|CONFIRMATION|CORRECTION|GREETING|THANKS|GOODBYE|SMALL_TALK|HELP_REQUEST|CLARIFICATION|USER_FRUSTRATION|GENERAL_QUESTION|PRODUCT_DETAILS|OTHER, intent: BUY_NOW|EXPLORING|ACTIVE_RESEARCH|UNKNOWN, category: DRIVER|FAIRWAY_WOOD|HYBRID|IRON|WEDGE|PUTTER|SET|null, requestedProductFamilies: array of DRIVER|FAIRWAY_WOOD|HYBRID|IRON|WEDGE|PUTTER|SET, searchScopeMode: ${SEARCH_SCOPE_MODE_CONTRACT}|null, catalogScopeIntent: EXPLICIT_FAMILIES|INHERIT_PREVIOUS_FAMILY|ALL_CLUBS|ALL_HANDED_EQUIPMENT|ALL_EQUIPMENT|null, productReference: string|null, declaredFacts: array of {field: handedness|handicap|shotTendency|objective|brand|conditionPreference|swingSpeed|setExperience|skill|purchaseTarget|relationship, value: string|number, durable: boolean, semanticStatus: KNOWN|UNKNOWN|NONE|NOT_APPLICABLE|DECLINED}, temporaryPreferences: string[], objection: PRICE|UNCERTAIN_FIT|BRAND|NEW_VS_USED|NEED_TO_THINK|WANT_OTHER_OPTION|null, wantsRecommendation: boolean, wantsHandoff: boolean, answersPendingQuestion: boolean, asksForExplanation: boolean, asksWhatInformationNeeded: boolean, topicChanged: boolean, confidence: number, entities: {purchaseTarget: SELF|OTHER_PERSON, relationship: SPOUSE|CHILD|FRIEND|OTHER|UNKNOWN, playerReference: string|null} }. VALUE AND STATUS ARE DISTINCT: semanticStatus is one of KNOWN|UNKNOWN|NONE|NOT_APPLICABLE|DECLINED; when KNOWN, value must be the canonical value (handedness RIGHT|LEFT, skill BEGINNER|INTERMEDIATE|ADVANCED, setExperience FIRST_SET|CURRENT_PLAYER), never the status itself. If pendingQuestion is supplied, use its expectedValues and allowedStatuses to interpret the answer. Taxonomía category: SET incluye set completo, juego completo de palos, equipo completo de golf y palos completos. Buscar/comprar/mostrar opciones es CATALOG_SEARCH y conserva category aunque no haya fitting; conveniencia es PRODUCT_ADVICE. 'este me sirve', 'me conviene este' y 'este es adecuado para mí' son ASK_PRODUCT_FIT; resuelve el producto desde currentPageProduct, lastInteractedProduct o focusedProduct. 'qué necesitas/qué dato te falta' es ASK_WHAT_INFORMATION_NEEDED. Una oferta pendiente START_PRODUCT_ADVICE y un 'sí/dale/revisemos' implican CONFIRMATION. 'principiante' con ASK_PLAYER_SKILL_LEVEL es skill BEGINNER; 'primer set' con ASK_SET_EXPERIENCE es FIRST_SET. Distingue BUYER y PLAYER; los hechos del cónyuge/hijo/amigo pertenecen al PLAYER. Si una familia de golf es clara, no devuelvas category null; OTHER sólo para conversación ajena al dominio. No inventes decisiones de Match, precio, disponibilidad o ranking; las decide el backend.`;
    const semanticReasonInstruction = ` reasonMode debe ser CATALOG_REASON cuando preguntan por qué apareció/muestraste el producto, y PERSONAL_FIT_REASON cuando preguntan por qué les conviene o es para ellos. Incluye siempre reasonMode en el JSON. ASK_PRODUCT_FIT es para 'este me sirve', 'me conviene este' o 'este es adecuado para mí' y requiere resolver el producto por contexto, no iniciar una búsqueda. El contrato exige catalogScopeIntent: EXPLICIT_FAMILIES|INHERIT_PREVIOUS_FAMILY|ALL_CLUBS|ALL_HANDED_EQUIPMENT|ALL_EQUIPMENT|null, requestedProductFamilies: array de DRIVER|FAIRWAY_WOOD|HYBRID|IRON|WEDGE|PUTTER|SET (vacío si el alcance es amplio), searchScopeMode: ${SEARCH_SCOPE_MODE_CONTRACT}|null, searchContinuationRelation: KEEP_SCOPE|BROADEN_SCOPE|REPLACE_SCOPE|null y searchContinuationReason: EXPLICIT_CURRENT_TURN|ELLIPTICAL_CONTINUATION|PREVIOUS_SCOPE_EXHAUSTED|null. 'qué tienes para zurdo', 'qué tienes disponible para zurdo' y 'qué opciones tienes para alguien zurdo' son CATALOG_SEARCH con catalogScopeIntent=ALL_HANDED_EQUIPMENT, searchScopeMode=ALL_EQUIPMENT y declaredFacts handedness=LEFT/KNOWN, aunque antes se hablara de SET. Las variantes para diestro declaran RIGHT/KNOWN. 'otro bastón para zurdo' usa ALL_CLUBS y excluye SET. 'tienes un driver o un wedge?' y 'muéstrame drivers o wedges' son CATALOG_SEARCH con catalogScopeIntent=EXPLICIT_FAMILIES, requestedProductFamilies=[DRIVER,WEDGE] y MULTI_FAMILY; sólo preguntas que pidan comparar son ASK_COMPARISON. 'este me sirve?' es ASK_PRODUCT_FIT. Una búsqueda explícita reemplaza el alcance anterior, pero conserva hechos del jugador.`;
    const rawText = await this.complete(system + semanticReasonInstruction, payload);
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
    return result.data;
  }
  async explainRecommendation(payload: SafeConversationPayload) {
    const system =
      "Redacta una respuesta breve en español basada exclusivamente en el DTO. No inventes productos, precios, stock ni descuentos. No menciones costes, margen, comisión ni vendedor. No calcules Match ni ranking. Nunca atribuyas confianza baja a inventario o disponibilidad: sólo usa confidenceReasons entregadas por backend. Respeta targetPlayer y, si no es SELF, no describas sus hechos con tú/tu. Devuelve JSON {text:string}.";
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
