import "server-only";

import { getAuthenticatedUser } from "@/lib/auth/user";
import {
  classifyConversationTurn,
  recommendationReply,
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
  const context = await loadMiGolfContext();
  const turn = classifyConversationTurn(
    input.state,
    input.message,
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
    return {
      ...turn,
      reply: recommendationReply(recommendation),
      recommendation,
      error: null,
    };
  }
  return { ...turn, recommendation: null, error: null };
}
