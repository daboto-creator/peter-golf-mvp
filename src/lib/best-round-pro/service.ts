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
  const context = await loadMiGolfContext();
  const intent = routeConversationIntent(input.message);
  const preFocusedProduct = input.state.productAdvice?.product ?? input.state.lastFocusedProduct ??
    (input.state.lastCatalogResults.length === 1 ? input.state.lastCatalogResults[0] : null);
  const provider = getConversationProvider();
  let interpretation: Awaited<ReturnType<NonNullable<typeof provider>["interpretTurn"]>> | null = null;
  if (provider) {
    try {
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
        },
      });
    } catch {
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
  for (const fact of interpretation?.declaredFacts ?? []) {
    participants.player.facts[fact.field] = { status: fact.semanticStatus, value: fact.value, confidence: interpretation?.confidence ?? 1, source: "USER" };
  }
  const asksWhatData = isAdviceMetaQuestion(input.message);
  const asksProductAdvice = isProductAdviceLanguage(input.message) || interpretation?.dialogueAct === "PRODUCT_ADVICE";
  const requestsRecommendation = asksProductAdvice || interpretation?.dialogueAct === "FITTING_REQUEST";
  const asksProductReason = interpretation?.dialogueAct === "ASK_PRODUCT_REASON" || /\bpor\s+que|porque|que\s+viste|por\s+que\s+lo\b/.test(normalizedMessage);
  const socialAct = interpretation?.dialogueAct ?? (intent === "OTHER" ? fallbackSocialIntent(input.message) : null);
  const appendSocialReply = (reply: string, event: string) => ({
    state: { ...input.state, messages: [...input.state.messages, { role: "user" as const, content: input.message }, { role: "assistant" as const, content: reply }] },
    reply, nextQuestion: null, objection: null, events: [event], recommendation: null, outcome: null, intent,
  });
  if (!input.state.productAdvice?.active && intent === "OTHER" && socialAct) {
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
  if (input.state.productAdvice?.active && interpretation?.dialogueAct === "GENERAL_QUESTION") {
    return appendSocialReply("Te lo pregunto porque ayuda a orientar el equipo al nivel de juego y evitar una opción demasiado exigente. Si no lo sabes, podemos seguir con otros datos.", "ADVICE_QUESTION_ANSWERED");
  }
  const focusedProduct = preFocusedProduct;
  if (asksProductReason && focusedProduct && !input.state.productAdvice?.active) {
    const reply = `Te mostré ${focusedProduct.name} porque es la opción de set completo disponible que encontré en el catálogo. Eso todavía no significa que sea la mejor para ti. Si quieres, revisamos si encaja contigo.`;
    const state: ConversationState = { ...input.state, messages: [...input.state.messages, { role: "user", content: input.message }, { role: "assistant", content: reply }], lastFocusedProduct: focusedProduct };
    return { state, reply, nextQuestion: null, objection: null, events: ["PRODUCT_REASON_EXPLAINED"], recommendation: null, outcome: null, intent: "PRODUCT_ADVICE" as const };
  }
  if (asksProductAdvice || (asksWhatData && focusedProduct && input.state.pendingQuestionCategory !== "PRODUCT_ADVICE")) {
    if (!focusedProduct && input.state.lastCatalogResults.length > 1) {
      const names = input.state.lastCatalogResults.slice(0, 2).map((product) => product.name);
      const reply = `¿Te refieres a ${names[0]} o a ${names[1]}?`;
      const state: ConversationState = {
        ...input.state,
        messages: [...input.state.messages, { role: "user", content: input.message }, { role: "assistant", content: reply }],
      };
      return { state, reply, nextQuestion: null, objection: null, events: ["PRODUCT_REFERENCE_CLARIFICATION"], recommendation: null, outcome: null, intent: "PRODUCT_ADVICE" as const };
    }
    if (focusedProduct) {
      const question = "Para saber si este producto encaja contigo, ¿juegas como diestro o zurdo?";
      const reply = asksWhatData
        ? `Para evaluar ${focusedProduct.name} necesito principalmente saber si juegas diestro o zurdo, tu nivel o handicap y qué buscas con el set. Empecemos por lo más importante: ¿juegas como diestro o zurdo?`
        : `Claro, revisemos si ${focusedProduct.name} encaja contigo. ${question}`;
      const state: ConversationState = {
        ...input.state,
        messages: [...input.state.messages, { role: "user", content: input.message }, { role: "assistant", content: reply }],
        pendingQuestionKey: "handedness",
        pendingQuestionCategory: "PRODUCT_ADVICE",
        pendingQuestionSlotType: "HANDEDNESS",
        lastFocusedProduct: focusedProduct,
        productAdvice: { active: true, product: focusedProduct, pendingQuestionKey: "handedness", collectedAnswers: input.state.session.diagnosticAnswers },
        participants,
      };
      return { state, reply, nextQuestion: null, objection: null, events: ["PRODUCT_ADVICE_STARTED"], recommendation: null, outcome: null, intent: "PRODUCT_ADVICE" as const };
    }
  }
  if (focusedProduct && (input.state.productAdvice?.active || input.state.pendingQuestionCategory === "PRODUCT_ADVICE")) {
    const answers = { ...input.state.session.diagnosticAnswers };
    for (const fact of interpretation?.declaredFacts ?? []) {
      if (["handedness", "handicap", "setExperience", "skill", "objective"].includes(fact.field))
        answers[fact.field] = fact.semanticStatus === "NONE" ? "NONE" : fact.semanticStatus === "UNKNOWN" ? "ANSWERED_UNKNOWN" : fact.semanticStatus === "DECLINED" ? "DECLINED" : fact.value;
    }
    const hand = /\b(?:zurdo|zurda|izquierdo|izquierda|left)\b/.test(normalizedMessage)
      ? "LEFT"
      : /\b(?:diestro|diestra|derecho|derecha|right)\b/.test(normalizedMessage)
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
        ...input.state,
        session: { ...input.state.session, diagnosticAnswers: answers },
        messages: [...input.state.messages, { role: "user", content: input.message }, { role: "assistant", content: reply }],
        pendingQuestionKey: null,
        pendingQuestionCategory: null,
        pendingQuestionSlotType: null,
        lastFocusedProduct: focusedProduct,
        productAdvice: { active: false, product: focusedProduct, pendingQuestionKey: null, collectedAnswers: answers },
        participants,
      };
      return { state, reply, nextQuestion: null, objection: null, events: ["PRODUCT_ADVICE_HARD_INCOMPATIBILITY"], recommendation: null, catalogProducts: alternatives.products, outcome: null, intent: "PRODUCT_ADVICE" as const };
    }
    const experience = Boolean(answers.setExperience) || /primer set|primera vez|apenas empie|principiante|ya juego|juego actualmente|reemplaz/.test(normalizedMessage);
    if (experience) answers.experience = normalizedMessage;
    const knownExperience = Boolean(answers.setExperience || answers.experience);
    const knownLevel = Boolean(answers.skill || answers.handicap);
    if (knownLevel && knownExperience && knownHand) {
      const reply = `Perfecto, con lo que me cuentas ya puedo orientarte sobre ${focusedProduct.name}. Es un set pensado para acompañarte en esta etapa; revisa su composición y condición, y si quieres puedo compararlo con otras opciones disponibles.`;
      const state: ConversationState = {
        ...input.state,
        session: { ...input.state.session, diagnosticAnswers: answers },
        messages: [...input.state.messages, { role: "user", content: input.message }, { role: "assistant", content: reply }],
        pendingQuestionKey: null,
        pendingQuestionCategory: null,
        pendingQuestionSlotType: null,
        lastFocusedProduct: focusedProduct,
        productAdvice: { active: false, product: focusedProduct, pendingQuestionKey: null, collectedAnswers: answers },
      };
      return { state, reply, nextQuestion: null, objection: null, events: ["PRODUCT_ADVICE_COMPLETED"], recommendation: null, outcome: null, intent: "PRODUCT_ADVICE" as const };
    }
    const nextAdviceQuestion = getNextProductAdviceQuestion({ answers });
    const reply = asksData
      ? `Para evaluar ${focusedProduct.name} necesito principalmente tu mano, si es tu primer set y tu nivel aproximado. ${knownHand ? `Ya sé que juegas ${hand === "LEFT" ? "zurdo" : hand === "RIGHT" ? "diestro" : answers.handedness === "LEFT" ? "zurdo" : "diestro"};` : "Empecemos por la mano;"} ¿es tu primer set o ya juegas actualmente?`
      : nextAdviceQuestion
        ? `Perfecto. Para orientarte mejor con ${focusedProduct.name}, ${nextAdviceQuestion.customerQuestion}`
        : `Perfecto. Con estos datos ya puedo orientarte sobre ${focusedProduct.name}.`;
    const state: ConversationState = {
      ...input.state,
      session: { ...input.state.session, diagnosticAnswers: answers },
      messages: [...input.state.messages, { role: "user", content: input.message }, { role: "assistant", content: reply }],
      pendingQuestionKey: nextAdviceQuestion?.key ?? null,
      pendingQuestionCategory: "PRODUCT_ADVICE",
      pendingQuestionSlotType: nextAdviceQuestion?.key === "skill" ? "HANDICAP" : nextAdviceQuestion?.key === "setExperience" ? "BOOLEAN_PREFERENCE" : nextAdviceQuestion ? "HANDEDNESS" : null,
      lastFocusedProduct: focusedProduct,
      productAdvice: { active: Boolean(nextAdviceQuestion), product: focusedProduct, pendingQuestionKey: nextAdviceQuestion?.key ?? null, collectedAnswers: answers },
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
      ...input.state,
      messages: [
        ...input.state.messages,
        { role: "user", content: input.message },
        { role: "assistant", content: reply },
      ],
      pendingQuestionKey: null,
      pendingQuestionCategory: null,
      pendingQuestionSlotType: null,
      lastCatalogResults: references,
      lastFocusedProduct: references.length === 1 ? references[0] : null,
      productAdvice: { active: false, product: null, pendingQuestionKey: null, collectedAnswers: {} },
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
  const interpretedState: ConversationState = interpretation?.declaredFacts.length
    ? { ...input.state, session: { ...input.state.session, diagnosticAnswers: { ...input.state.session.diagnosticAnswers, ...Object.fromEntries(interpretation.declaredFacts.map((fact) => [fact.field, fact.value])) } } }
    : input.state;
  const turn = classifyConversationTurn(
    interpretedState,
    `${input.message} ${hints}`,
    context.profile,
  );
  // A direct recommendation request is an action, not another diagnostic turn.
  // Execute the existing deterministic pipeline immediately when a category is active.
  if ((!turn.nextQuestion || requestsRecommendation) && turn.state.session.requestedCategory) {
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
      golfer: context.profile,
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
      ...turn,
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
  const outcome = turn.nextQuestion ? null : terminalOutcome;
  const reply = turn.nextQuestion ? turn.reply : terminalOutcome.message;
  return withFinalReply({
    ...turn,
    reply,
    recommendation: null,
    outcome,
    error: null,
  });
}
