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
} from "@/lib/best-round-pro/intent-router";
import { searchCommercialCatalog } from "@/lib/best-round-pro/catalog-search";
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
  const normalizedMessage = input.message
    .toLocaleLowerCase("es-MX")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const asksWhatData = /(?:que|qué)\s+(?:datos|informacion|información)\s+necesitas|que\s+te\s+falta|que\s+necesitas\s+saber/.test(normalizedMessage);
  const asksProductAdvice = /\b(?:ese|esa|ese set|ese producto|el que me mostraste)\b/.test(normalizedMessage) &&
    /\b(?:bueno para mi|sirve|conviene|recomiendas|tal)\b/.test(normalizedMessage) ||
    /\b(?:es bueno para mi|me sirve|me conviene|que tal ese|me recomiendas ese)\b/.test(normalizedMessage);
  const focusedProduct = input.state.lastFocusedProduct ??
    (input.state.lastCatalogResults.length === 1 ? input.state.lastCatalogResults[0] : null);
  if (asksProductAdvice || (asksWhatData && focusedProduct)) {
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
      };
      return { state, reply, nextQuestion: null, objection: null, events: ["PRODUCT_ADVICE_STARTED"], recommendation: null, outcome: null, intent: "PRODUCT_ADVICE" as const };
    }
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
  const provider = getConversationProvider();
  let interpretation: Awaited<
    ReturnType<NonNullable<typeof provider>["interpretTurn"]>
  > | null = null;
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
        nextQuestionKey: input.state.pendingQuestionKey,
        pendingQuestionSlotType: input.state.pendingQuestionSlotType,
      });
    } catch {
      interpretation = null;
    }
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
    input.state,
    `${input.message} ${hints}`,
    context.profile,
  );
  if (!turn.nextQuestion && turn.state.session.requestedCategory) {
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
