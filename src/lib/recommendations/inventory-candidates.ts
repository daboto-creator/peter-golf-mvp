import "server-only";

import { serverEnv } from "@/env/server";
import { normalizeMatchCategory } from "@/lib/matching/equipment-matching";
import {
  matchInventoryCandidates,
  rankInventoryCandidates,
  type CommercialRankingResult,
  type MatchInventoryInput,
  type RankingPreferences,
} from "@/lib/recommendations/commercial-ranking";
import { createClient } from "@/lib/supabase/server";
import type {
  EquipmentUnitSpecifications,
  InventoryUnit,
  MatchCategory,
} from "@/lib/mi-golf/domain";
import type { Json } from "@/types/database.types";

export type InventoryCandidateLoadResult =
  { data: InventoryUnit[]; error: null } | { data: null; error: "UNAVAILABLE" };
export type RankedInventoryLoadResult =
  | { data: CommercialRankingResult; error: null }
  | { data: null; error: "UNAVAILABLE" };

function record(value: Json | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function finiteNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function specifications(value: Json | null): EquipmentUnitSpecifications {
  const source = record(value);
  return {
    handedness: nullableString(source.handedness),
    loftDegrees: finiteNumber(source.loftDegrees),
    shaftFlex: nullableString(source.shaftFlex),
    shaftMaterial: nullableString(source.shaftMaterial),
    shaftWeightGrams: finiteNumber(source.shaftWeightGrams),
    adjustableLoft:
      typeof source.adjustableLoft === "boolean" ? source.adjustableLoft : null,
    adjustableHosel:
      typeof source.adjustableHosel === "boolean"
        ? source.adjustableHosel
        : null,
    forgiveness:
      source.forgiveness === "HIGH" ||
      source.forgiveness === "MEDIUM" ||
      source.forgiveness === "LOW"
        ? source.forgiveness
        : null,
    drawBias: typeof source.drawBias === "boolean" ? source.drawBias : null,
    setMakeup: Array.isArray(source.setMakeup)
      ? source.setMakeup.filter(
          (item): item is string => typeof item === "string",
        )
      : null,
    bounceDegrees: finiteNumber(source.bounceDegrees),
    grind: nullableString(source.grind),
    putterHeadType: nullableString(source.putterHeadType),
    strokeFit: nullableString(source.strokeFit),
    lengthInches: finiteNumber(source.lengthInches),
    lieDegrees: finiteNumber(source.lieDegrees),
    clubLengthInches: finiteNumber(source.clubLengthInches),
  };
}

function categoryFromMarketplace(row: {
  club_type: string | null;
  set_type: string | null;
  category_name: string;
}): MatchCategory | null {
  if (row.set_type === "iron_set") return "IRON";
  try {
    return normalizeMatchCategory(row.club_type ?? row.category_name);
  } catch {
    return null;
  }
}

/**
 * Loads already-authorized, currently sellable rows in two bounded database
 * calls. The returned DTO contains no Partner identity, acquisition cost,
 * margin, commission, or internal priority.
 */
export async function loadInventoryUnits(): Promise<InventoryCandidateLoadResult> {
  try {
    const client = await createClient();
    const [firstParty, marketplace] = await Promise.all([
      client.rpc("get_best_round_first_party_inventory"),
      serverEnv.MARKETPLACE_ENABLED
        ? client.rpc("get_public_marketplace_catalog", {
            requested_slug: undefined,
          })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (firstParty.error || marketplace.error)
      return { data: null, error: "UNAVAILABLE" };

    const firstPartyUnits: InventoryUnit[] = (firstParty.data ?? []).map(
      (row) => ({
        productId: row.product_id,
        unitId: row.unit_id,
        canonicalModelId: row.canonical_model_id,
        source: "FIRST_PARTY",
        category: normalizeMatchCategory(row.match_category),
        brand: row.brand_name,
        model: row.model_name,
        condition: row.condition,
        priceMxnMinor: finiteNumber(row.price),
        availability: "AVAILABLE",
        stock: row.available_quantity,
        technicalSpecs: specifications(row.technical_specs),
      }),
    );
    const marketplaceUnits: InventoryUnit[] = (marketplace.data ?? []).flatMap(
      (row) => {
        const category = categoryFromMarketplace(row);
        if (!category) return [];
        return [
          {
            productId: row.listing_id,
            unitId: row.listing_id,
            canonicalModelId: null,
            source: "MARKETPLACE",
            category,
            brand: row.brand_name,
            model: row.model_name,
            condition: row.condition,
            priceMxnMinor: finiteNumber(row.public_price),
            availability:
              row.available_quantity > 0 ? "AVAILABLE" : "UNAVAILABLE",
            stock: row.available_quantity,
            technicalSpecs: specifications(row.specifications),
          },
        ];
      },
    );
    return {
      data: [...firstPartyUnits, ...marketplaceUnits].filter(
        (unit) =>
          unit.availability === "AVAILABLE" &&
          unit.stock !== null &&
          unit.stock > 0 &&
          unit.priceMxnMinor !== null,
      ),
      error: null,
    };
  } catch {
    return { data: null, error: "UNAVAILABLE" };
  }
}

export async function resolveRankedInventory(
  input: Omit<MatchInventoryInput, "units"> & {
    preferences?: RankingPreferences;
  },
): Promise<RankedInventoryLoadResult> {
  const inventory = await loadInventoryUnits();
  if (inventory.error) return inventory;
  const candidates = matchInventoryCandidates({
    golfer: input.golfer,
    currentEquipment: input.currentEquipment,
    objectives: input.objectives,
    measurements: input.measurements,
    units: inventory.data,
  });
  return {
    data: rankInventoryCandidates(candidates, input.preferences),
    error: null,
  };
}
