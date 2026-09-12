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
  questionPromptFor,
} from "@/lib/best-round-pro/conversation";
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
import { searchCommercialCatalog, searchCompleteSetAlternatives } from "@/lib/best-round-pro/catalog-search";
import type { CatalogProductReference } from "@/lib/best-round-pro/conversation";

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
  validationIssues?: Array<{ path: string; code: string; expected?: string; received?: string }>;
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
};

export function getLastInterpreterTelemetry() {
  return lastInterpreterTelemetry;
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
  const preFocusedProduct = input.state.productAdvice?.product ?? input.state.lastFocusedProduct ??
    (input.state.lastCatalogResults.length === 1 ? input.state.lastCatalogResults[0] : null);
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
        skill: "ASK_PLAYER_SKILL_LEVEL",
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
          activeAdvice: Boolean(input.state.productAdvice?.active),
          participantContext: {
            relationToBuyer: input.state.participants.player.relationToBuyer,
            displayReference: input.state.participants.player.displayReference,
          },
          pendingQuestion: pendingKey ? {
            key: pendingKey,
            meaning: pendingMeaning[pendingKey] ?? "ANSWER_PENDING_QUESTION",
            targetEntity: "PLAYER",
            expectedSemanticDomain: ["KNOWN", "UNKNOWN", "NONE", "DECLINED"],
          } : null,
        },
      });
      lastInterpreterTelemetry = {
        ...lastInterpreterTelemetry,
        providerSucceeded: true,
        interpretationSource: "LLM",
        interpretationConfidence: interpretation.confidence,
        stage: "REDUCE_STATE",
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
  const normalizedMessage = normalizeConversationText(input.message);
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
  for (const fact of interpretation?.declaredFacts ?? []) {
    participants.player.facts[fact.field] = { status: fact.semanticStatus, value: fact.value, confidence: interpretation?.confidence ?? 1, source: "USER" };
  }
  const interpretedAnswers = Object.fromEntries(
    (interpretation?.declaredFacts ?? []).map((fact) => [
      fact.field,
      fact.semanticStatus === "NONE" ? "NONE" :
        fact.semanticStatus === "UNKNOWN" ? "ANSWERED_UNKNOWN" :
          fact.semanticStatus === "DECLINED" ? "DECLINED" : fact.value,
    ]),
  );
  // Single semantic reduction point. Every policy/domain branch below reads
  // this updated state, never the stale input snapshot.
  const updatedState: ConversationState = {
    ...input.state,
    session: {
      ...input.state.session,
      requestedCategory: interpretation?.category ?? input.state.session.requestedCategory,
      diagnosticAnswers: {
        ...input.state.session.diagnosticAnswers,
        ...interpretedAnswers,
      },
    },
    participants,
  };
  const playerPerspective = getPlayerPerspective(participants);
  const intent = interpretation?.dialogueAct === "CATALOG_SEARCH" || interpretation?.dialogueAct === "PRODUCT_DETAILS"
    ? "CATALOG_SEARCH" as const
    : interpretation?.dialogueAct === "PRODUCT_ADVICE" || interpretation?.dialogueAct === "FITTING_REQUEST"
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
  const requestsRecommendation = asksProductAdvice || interpretation?.dialogueAct === "FITTING_REQUEST";
  const asksProductReason = interpretation
    ? interpretation.dialogueAct === "ASK_PRODUCT_REASON" || interpretation.asksForExplanation
    : /\bpor\s+que|porque|que\s+viste|por\s+que\s+lo\b/.test(normalizedMessage);
  const socialAct = interpretation?.dialogueAct ?? (intent === "OTHER" ? fallbackSocialIntent(input.message) : null);
  const appendSocialReply = (reply: string, event: string) => ({
    state: { ...updatedState, messages: [...updatedState.messages, { role: "user" as const, content: input.message }, { role: "assistant" as const, content: reply }] },
    reply, nextQuestion: null, objection: null, events: [event], recommendation: null, outcome: null, intent,
  });
  if (!updatedState.productAdvice?.active && intent === "OTHER" && socialAct) {
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
  if (updatedState.productAdvice?.active && interpretation?.dialogueAct === "GENERAL_QUESTION") {
    return appendSocialReply("Te lo pregunto porque ayuda a orientar el equipo al nivel de juego y evitar una opción demasiado exigente. Si no lo sabes, podemos seguir con otros datos.", "ADVICE_QUESTION_ANSWERED");
  }
  const focusedProduct = preFocusedProduct;
  if (interpretation?.dialogueAct === "CONFIRMATION" && updatedState.pendingAssistantOffer?.action === "START_PRODUCT_ADVICE" && focusedProduct) {
    const question = `Lo primero que necesito saber es si ${playerPerspective.isSelf ? "juegas" : `${playerPerspective.subject} juega`} como diestro o zurdo.`;
    const state: ConversationState = {
      ...updatedState,
      messages: [...updatedState.messages, { role: "user", content: input.message }, { role: "assistant", content: question }],
      pendingQuestionKey: "handedness",
      pendingQuestionCategory: "PRODUCT_ADVICE",
      pendingQuestionSlotType: "HANDEDNESS",
      pendingAssistantOffer: null,
      productAdvice: { active: true, product: focusedProduct, pendingQuestionKey: "handedness", collectedAnswers: updatedState.session.diagnosticAnswers },
    };
    return { state, reply: question, nextQuestion: null, objection: null, events: ["PRODUCT_ADVICE_CONFIRMED"], recommendation: null, outcome: null, intent: "PRODUCT_ADVICE" as const };
  }
  if (asksProductReason && focusedProduct && !updatedState.productAdvice?.active) {
    const targetPhrase = playerPerspective.isSelf ? "encaja contigo" : `encaja con el juego de ${playerPerspective.displayReference}`;
    const reply = `Te mostré ${focusedProduct.name} porque es la opción de set completo disponible que encontré en el catálogo. Eso todavía no significa que sea la mejor para ti. Si quieres, revisamos si ${targetPhrase}.`;
    const state: ConversationState = { ...updatedState, messages: [...updatedState.messages, { role: "user", content: input.message }, { role: "assistant", content: reply }], lastFocusedProduct: focusedProduct, pendingAssistantOffer: { action: "START_PRODUCT_ADVICE", targetProductIds: [focusedProduct.id], createdAtTurn: updatedState.messages.length + 1 } };
    return { state, reply, nextQuestion: null, objection: null, events: ["PRODUCT_REASON_EXPLAINED"], recommendation: null, outcome: null, intent: "PRODUCT_ADVICE" as const };
  }
  if (asksProductAdvice || (asksWhatData && focusedProduct && updatedState.pendingQuestionCategory !== "PRODUCT_ADVICE")) {
    if (!focusedProduct && updatedState.lastCatalogResults.length > 1) {
      const names = updatedState.lastCatalogResults.slice(0, 2).map((product) => product.name);
      const reply = `¿Te refieres a ${names[0]} o a ${names[1]}?`;
      const state: ConversationState = {
        ...updatedState,
        messages: [...updatedState.messages, { role: "user", content: input.message }, { role: "assistant", content: reply }],
      };
      return { state, reply, nextQuestion: null, objection: null, events: ["PRODUCT_REFERENCE_CLARIFICATION"], recommendation: null, outcome: null, intent: "PRODUCT_ADVICE" as const };
    }
    if (focusedProduct) {
      const handQuestion = questionPromptFor({ key: "handedness", meaning: "ASK_PLAYER_HANDEDNESS", importance: "MATERIAL", targetEntity: "PLAYER" }, playerPerspective, focusedProduct.category);
      const question = `Para saber si este producto encaja ${playerPerspective.isSelf ? "contigo" : `con el juego de ${playerPerspective.subject}`}, ${handQuestion?.toLowerCase() ?? "necesito confirmar la mano del jugador."}`;
      const reply = asksWhatData
        ? `Para evaluar ${focusedProduct.name} necesito principalmente confirmar la mano de ${playerPerspective.isSelf ? "quien lo va a usar" : playerPerspective.subject}, su nivel o handicap y qué busca con el set. Empecemos por lo más importante: ${handQuestion}`
        : `Claro, revisemos si ${focusedProduct.name} encaja ${playerPerspective.isSelf ? "contigo" : `con el juego de ${playerPerspective.subject}`}. ${question}`;
      const state: ConversationState = {
        ...updatedState,
        messages: [...updatedState.messages, { role: "user", content: input.message }, { role: "assistant", content: reply }],
        pendingQuestionKey: "handedness",
        pendingQuestionCategory: "PRODUCT_ADVICE",
        pendingQuestionSlotType: "HANDEDNESS",
        lastFocusedProduct: focusedProduct,
        productAdvice: { active: true, product: focusedProduct, pendingQuestionKey: "handedness", collectedAnswers: updatedState.session.diagnosticAnswers },
        pendingAssistantOffer: null,
        participants,
      };
      return { state, reply, nextQuestion: null, objection: null, events: ["PRODUCT_ADVICE_STARTED"], recommendation: null, outcome: null, intent: "PRODUCT_ADVICE" as const };
    }
  }
  if (focusedProduct && (updatedState.productAdvice?.active || updatedState.pendingQuestionCategory === "PRODUCT_ADVICE")) {
    const answers = { ...updatedState.session.diagnosticAnswers };
    for (const fact of interpretation?.declaredFacts ?? []) {
      if (["handedness", "handicap", "setExperience", "skill", "objective"].includes(fact.field))
        answers[fact.field] = fact.semanticStatus === "NONE" ? "NONE" : fact.semanticStatus === "UNKNOWN" ? "ANSWERED_UNKNOWN" : fact.semanticStatus === "DECLINED" ? "DECLINED" : fact.value;
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
    const productHand = focusedProduct.handedness === "LEFT" || focusedProduct.handedness === "RIGHT" ? focusedProduct.handedness : null;
    if (evaluation.status === "HARD_INCOMPATIBLE" && hand && productHand) {
      const alternatives = await searchCompleteSetAlternatives(hand);
      const expected = productHand === "RIGHT" ? "diestro" : "zurdo";
      const reply = `Este ${focusedProduct.name} disponible es para ${expected}, así que no te serviría si juegas ${hand === "LEFT" ? "zurdo" : "diestro"}. ${alternatives.products.length ? `Encontré ${alternatives.products.length} alternativa${alternatives.products.length === 1 ? "" : "s"} para ti.` : `Revisé el inventario y ahora mismo no tengo otro set completo para ${hand === "LEFT" ? "zurdo" : "diestro"} disponible.`} Si quieres, puedo ayudarte a buscar otra alternativa.`;
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
      };
      return { state, reply, nextQuestion: null, objection: null, events: ["PRODUCT_ADVICE_HARD_INCOMPATIBILITY"], recommendation: null, catalogProducts: alternatives.products, outcome: null, intent: "PRODUCT_ADVICE" as const };
    }
    const experience = Boolean(answers.setExperience) || (!interpretation && /primer set|primera vez|apenas empie|principiante|ya juego|juego actualmente|reemplaz/.test(normalizedMessage));
    if (experience) answers.experience = normalizedMessage;
    const knownExperience = Boolean(answers.setExperience || answers.experience);
    const knownLevel = Boolean(answers.skill || answers.handicap);
    if (knownLevel && knownExperience && knownHand) {
      const reply = `Perfecto, con lo que me cuentas ya puedo orientarte sobre ${focusedProduct.name}. Es un set pensado para acompañarte en esta etapa; revisa su composición y condición, y si quieres puedo compararlo con otras opciones disponibles.`;
      const state: ConversationState = {
        ...updatedState,
        session: { ...updatedState.session, diagnosticAnswers: answers },
        messages: [...updatedState.messages, { role: "user", content: input.message }, { role: "assistant", content: reply }],
        pendingQuestionKey: null,
        pendingQuestionCategory: null,
        pendingQuestionSlotType: null,
        lastFocusedProduct: focusedProduct,
        productAdvice: { active: false, product: focusedProduct, pendingQuestionKey: null, collectedAnswers: answers },
      };
      return { state, reply, nextQuestion: null, objection: null, events: ["PRODUCT_ADVICE_COMPLETED"], recommendation: null, outcome: null, intent: "PRODUCT_ADVICE" as const };
    }
    const nextAdviceQuestion = getNextProductAdviceQuestion({ answers });
    const playerLabel = participants.player.relationToBuyer === "SELF" ? "tu" : `${participants.player.displayReference}`;
    const semanticQuestion = questionPromptFor(nextAdviceQuestion, playerPerspective, focusedProduct.category);
    const reply = asksData
      ? `Para evaluar ${focusedProduct.name} necesito principalmente saber si ${playerLabel} juega diestro o zurdo, su nivel aproximado y si es su primer set. ${knownHand ? `Ya sé que ${participants.player.relationToBuyer === "SELF" ? "juegas" : `${participants.player.displayReference} juega`} ${hand === "LEFT" ? "zurdo" : hand === "RIGHT" ? "diestro" : answers.handedness === "LEFT" ? "zurdo" : "diestro"};` : "Empecemos por la mano;"} ¿${participants.player.relationToBuyer === "SELF" ? "juegas" : `${participants.player.displayReference} juega`} como diestro o zurdo?`
      : semanticQuestion
        ? `Perfecto. Para orientarte mejor con ${focusedProduct.name}, ${semanticQuestion}`
        : `Perfecto. Con estos datos ya puedo orientarte sobre ${focusedProduct.name}.`;
    const state: ConversationState = {
      ...updatedState,
      session: { ...updatedState.session, diagnosticAnswers: answers },
      messages: [...updatedState.messages, { role: "user", content: input.message }, { role: "assistant", content: reply }],
      pendingQuestionKey: nextAdviceQuestion?.key ?? null,
      pendingQuestionCategory: "PRODUCT_ADVICE",
      pendingQuestionSlotType: nextAdviceQuestion?.key === "skill" ? "HANDICAP" : nextAdviceQuestion?.key === "setExperience" ? "BOOLEAN_PREFERENCE" : nextAdviceQuestion ? "HANDEDNESS" : null,
      lastFocusedProduct: focusedProduct,
      productAdvice: { active: Boolean(nextAdviceQuestion), product: focusedProduct, pendingQuestionKey: nextAdviceQuestion?.key ?? null, collectedAnswers: answers },
      pendingAssistantOffer: null,
      participants,
    };
    return { state, reply, nextQuestion: null, objection: null, events: ["PRODUCT_ADVICE_PROGRESS"], recommendation: null, outcome: null, intent: "PRODUCT_ADVICE" as const };
  }
  if (isCatalogIntent(intent)) {
    const catalog = await searchCommercialCatalog(input.message);
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
    }));
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
      lastFocusedProduct: references.length === 1 ? references[0] : null,
      productAdvice: { active: false, product: null, pendingQuestionKey: null, collectedAnswers: {} },
      pendingAssistantOffer: null,
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
        turn.state.session.diagnosticAnswers.handedness,
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
          turn.state.session.diagnosticAnswers.handedness,
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
