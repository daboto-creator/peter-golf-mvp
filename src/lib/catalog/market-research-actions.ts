"use server";

import { createHash } from "node:crypto";

import { z } from "zod";

import { requireCatalogManager } from "@/lib/auth/catalog-authorization";
import type {
  MarketResearchActionResult,
  MarketResearchRequest,
} from "@/lib/catalog/market-research-types";
import { parseMoneyToMinorUnits } from "@/lib/catalog/product-validation";
import type {
  MarketPriceInput,
  MarketPriceResult,
} from "@/lib/pricing/market-price-provider";
import { researchMarketPriceSafely } from "@/lib/pricing/market-price-resilience";
import { getConfiguredMarketPriceProvider } from "@/lib/pricing/market-price-service";
import { createClient } from "@/lib/supabase/server";

const CACHE_TTL_MS = 15 * 60 * 1_000;

const requestSchema = z.object({
  productId: z.uuid().nullable(),
  brandId: z.uuid(),
  categoryId: z.uuid(),
  condition: z.enum(["new", "used"]),
  conditionGrade: z.string().trim().max(40).nullable(),
  conditionScore: z.number().int().min(1).max(10).nullable(),
  targetPlayer: z.string().trim().max(40).nullable(),
  model: z.string().trim().min(1).max(160),
  modelYear: z.number().int().min(1900).max(2200).nullable(),
  clubNumber: z.string().trim().max(40).nullable(),
  loftDegrees: z.number().min(0).max(90).nullable(),
  handedness: z.string().trim().max(40).nullable(),
  shaftMaterial: z.string().trim().max(40).nullable(),
  shaftBrand: z.string().trim().max(120).nullable(),
  shaftModel: z.string().trim().max(160).nullable(),
  shaftFlex: z.string().trim().max(40).nullable(),
  acquisitionCost: z.string().trim(),
});

const sourceSchema = z.object({
  merchant: z.string(),
  productName: z.string(),
  priceMxn: z.number().int().positive(),
  originalCurrency: z.string(),
  originalPrice: z.string(),
  url: z.string().url().nullable(),
  identifier: z.string().nullable(),
  availability: z.enum(["in_stock", "out_of_stock", "unknown"]),
  condition: z.enum(["new", "used", "refurbished", "unknown"]),
  marketScope: z.enum([
    "mexico",
    "ships_to_mexico",
    "international",
    "unknown",
  ]),
  matchScore: z.number().int().min(0).max(100),
  checkedAt: z.string(),
  matchConfidence: z.enum(["high", "medium", "low"]),
});

const resultSchema = z.object({
  medianPriceMxn: z.number().int().positive().nullable(),
  averagePriceMxn: z.number().int().positive().nullable(),
  lowPriceMxn: z.number().int().positive().nullable(),
  highPriceMxn: z.number().int().positive().nullable(),
  sampleSize: z.number().int().nonnegative(),
  confidence: z.enum(["high", "medium", "low", "unavailable"]),
  source: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  checkedAt: z.string().nullable(),
  provider: z.string(),
  searchQuery: z.string().nullable(),
  sources: z.array(sourceSchema).max(100),
  excludedCount: z.number().int().nonnegative(),
});

function fingerprint(input: MarketPriceInput): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export async function researchProductMarketAction(
  request: MarketResearchRequest,
  forceRefresh = false,
): Promise<MarketResearchActionResult> {
  await requireCatalogManager("/operacion/catalogo");
  const parsed = requestSchema.safeParse(request);
  if (
    !parsed.success ||
    (parseMoneyToMinorUnits(parsed.data.acquisitionCost) ?? 0) <= 0
  ) {
    return {
      status: "error",
      message:
        "Completa marca, categoría, modelo y costo de adquisición antes de calcular.",
    };
  }

  const client = await createClient();
  const [brandResult, categoryResult] = await Promise.all([
    client
      .from("brands")
      .select("id, name")
      .eq("id", parsed.data.brandId)
      .maybeSingle(),
    client
      .from("category_spec_profiles")
      .select("family, club_type, bag_type, set_type")
      .eq("category_id", parsed.data.categoryId)
      .maybeSingle(),
  ]);
  if (brandResult.error || !brandResult.data || categoryResult.error) {
    return {
      status: "error",
      message: "No pudimos validar la identidad del producto.",
    };
  }

  const profile = categoryResult.data;
  const marketInput: MarketPriceInput = {
    brand: brandResult.data.name,
    model: parsed.data.model,
    modelYear: parsed.data.modelYear,
    productFamily: profile?.family ?? null,
    clubType: profile?.club_type ?? null,
    clubNumber: parsed.data.clubNumber,
    setType: profile?.set_type ?? null,
    bagType: profile?.bag_type ?? null,
    loftDegrees: parsed.data.loftDegrees,
    handedness: parsed.data.handedness,
    shaftMaterial: parsed.data.shaftMaterial,
    shaftBrand: parsed.data.shaftBrand,
    shaftModel: parsed.data.shaftModel,
    shaftFlex: parsed.data.shaftFlex,
    condition: parsed.data.condition,
    conditionGrade: parsed.data.conditionGrade,
    conditionScore: parsed.data.conditionScore,
    targetPlayer: parsed.data.targetPlayer,
    market: "MX",
  };
  const inputFingerprint = fingerprint(marketInput);
  const configuredProvider = getConfiguredMarketPriceProvider();

  if (!forceRefresh) {
    const cached = await client
      .from("market_price_researches")
      .select("id, result_snapshot")
      .eq("input_fingerprint", inputFingerprint)
      .eq("provider", configuredProvider.name)
      .gt("expires_at", new Date().toISOString())
      .order("checked_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const cachedResult = resultSchema.safeParse(cached.data?.result_snapshot);
    if (!cached.error && cached.data && cachedResult.success) {
      return {
        status:
          cachedResult.data.confidence === "unavailable"
            ? "unavailable"
            : "success",
        message: "Referencia reciente reutilizada.",
        researchId: cached.data.id,
        market: cachedResult.data,
        fromCache: true,
      };
    }
  }

  const researched = await researchMarketPriceSafely(marketInput, {
    provider: configuredProvider.provider,
    forceRefresh,
    failureProviderName: configuredProvider.name,
  });
  const checkedAt = researched.result.checkedAt ?? new Date().toISOString();
  const market: MarketPriceResult = { ...researched.result, checkedAt };
  const expiresAt = new Date(
    new Date(checkedAt).getTime() + CACHE_TTL_MS,
  ).toISOString();
  const recorded = await client.rpc("record_market_price_research", {
    requested_average_price: market.averagePriceMxn,
    requested_brand_id: parsed.data.brandId,
    requested_category_id: parsed.data.categoryId,
    requested_checked_at: checkedAt,
    requested_condition: parsed.data.condition,
    requested_confidence: market.confidence,
    requested_excluded_count: market.excludedCount,
    requested_expires_at: expiresAt,
    requested_high_price: market.highPriceMxn,
    requested_input_fingerprint: inputFingerprint,
    requested_input_snapshot: marketInput,
    requested_low_price: market.lowPriceMxn,
    requested_median_price: market.medianPriceMxn,
    requested_product_id: parsed.data.productId,
    requested_provider: market.provider,
    requested_result_snapshot: market,
    requested_sample_size: market.sampleSize,
    requested_search_query: market.searchQuery,
  });
  if (recorded.error || !recorded.data) {
    return {
      status: "error",
      message: "No pudimos conservar la investigación de mercado.",
    };
  }

  return {
    status: market.confidence === "unavailable" ? "unavailable" : "success",
    message: researched.failed
      ? "No fue posible consultar el mercado en este momento. El cálculo financiero sigue disponible."
      : market.confidence === "unavailable"
        ? "No encontramos comparables suficientemente válidos."
        : "Mercado México actualizado.",
    researchId: recorded.data,
    market,
    fromCache: false,
  };
}
