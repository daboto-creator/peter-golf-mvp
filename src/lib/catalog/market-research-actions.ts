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
import { getConfiguredMarketPriceProvider } from "@/lib/pricing/market-price-service";
import {
  calculateFirstPartyDecision,
  type EconomicsCosts,
} from "@/lib/pricing/intelligence-economics";
import {
  buildResearchFingerprint,
  COMPARABLE_CLASSIFIER_VERSION,
  researchBestRoundIntelligence,
  CURRENCY_NORMALIZATION_VERSION,
  INTELLIGENCE_ENGINE_VERSION,
  type ResearchCandidate,
  type ResearchProductInput,
  type ResearchResult,
} from "@/lib/pricing/intelligence-research";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1_000;

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
  conditioningCost: z.string().trim().default("0"),
  packagingCost: z.string().trim().default("0"),
  shippingSubsidy: z.string().trim().default("0"),
});

function fingerprint(input: MarketPriceInput): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function minor(value: string): number {
  return parseMoneyToMinorUnits(value) ?? 0;
}

function candidateFromSnapshot(
  row: Record<string, unknown>,
  market: "BEST_ROUND_SALE" | "SAVED_RESEARCH",
): ResearchCandidate | null {
  const price = Number(
    market === "BEST_ROUND_SALE" ? row.final_sold_price_minor : row.priceMinor,
  );
  const observedAt = String(row.sold_at ?? row.observedAt ?? "");
  if (!Number.isSafeInteger(price) || price <= 0 || !observedAt) return null;
  const title = String(
    row.title ??
      row.product_name ??
      row.productName ??
      (typeof row.canonical_model === "string"
        ? `${typeof row.brand === "string" ? `${row.brand} ` : ""}${row.canonical_model}`
        : ""),
  );
  if (!title) return null;
  return {
    title,
    seller: String(row.seller ?? "Best Round"),
    priceMinor: price,
    currency: "MXN",
    originalPriceMinor: price,
    originalCurrency: "MXN",
    normalizedPriceMxnMinor: price,
    normalizationSource: "stored-mxn",
    market,
    source: String(
      row.source ?? (market === "SAVED_RESEARCH" ? "saved" : "best-round"),
    ),
    url: typeof row.url === "string" ? row.url : null,
    condition:
      row.condition === "new" || row.condition === "used"
        ? row.condition
        : "unknown",
    availability: "in_stock",
    observedAt,
    product: {
      brand: typeof row.brand === "string" ? row.brand : null,
      model:
        typeof row.canonical_model === "string" ? row.canonical_model : null,
      category: typeof row.category === "string" ? row.category : null,
    },
  };
}

function savedCandidates(
  snapshot: unknown,
  currentFingerprint: string,
): ResearchCandidate[] {
  if (!snapshot || typeof snapshot !== "object") return [];
  const record = snapshot as Record<string, unknown>;
  const intelligence = record.intelligence;
  if (!intelligence || typeof intelligence !== "object") return [];
  const research = (intelligence as Record<string, unknown>).research;
  if (!research || typeof research !== "object") return [];
  const researchRecord = research as Record<string, unknown>;
  if (
    researchRecord.engineVersion !== INTELLIGENCE_ENGINE_VERSION ||
    researchRecord.currencyNormalizationVersion !==
      CURRENCY_NORMALIZATION_VERSION ||
    researchRecord.comparableClassifierVersion !==
      COMPARABLE_CLASSIFIER_VERSION ||
    researchRecord.fingerprint !== currentFingerprint
  )
    return [];
  const candidates = researchRecord.acceptedComparables;
  if (!Array.isArray(candidates)) return [];
  return candidates.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const row = candidate as Record<string, unknown>;
    const price = Number(row.normalizedPriceMxnMinor ?? row.priceMinor);
    if (
      !Number.isSafeInteger(price) ||
      price <= 0 ||
      row.currency !== "MXN" ||
      row.normalizedPriceMxnMinor !== price
    )
      return [];
    const mapped = candidateFromSnapshot(
      {
        ...row,
        priceMinor: price,
        originalPriceMinor: row.originalPriceMinor ?? price,
        originalCurrency: row.originalCurrency ?? "MXN",
        observedAt: row.observedAt,
      },
      "SAVED_RESEARCH",
    );
    return mapped ? [mapped] : [];
  });
}

function toMarketResult(research: ResearchResult): MarketPriceResult {
  const candidates = research.acceptedComparables;
  const ordered = candidates
    .map((candidate) => candidate.priceMinor)
    .sort((a, b) => a - b);
  const median = ordered.length
    ? ordered[Math.floor(ordered.length / 2)]
    : null;
  const average = ordered.length
    ? Math.round(
        ordered.reduce((sum, value) => sum + value, 0) / ordered.length,
      )
    : null;
  const sources = candidates.map((candidate) => ({
    merchant: candidate.seller,
    productName: candidate.title,
    priceMxn: candidate.priceMinor,
    originalCurrency: candidate.originalCurrency ?? "MXN",
    originalPrice: String(
      (candidate.originalPriceMinor ?? candidate.priceMinor) / 100,
    ),
    normalizationSource: candidate.normalizationSource ?? undefined,
    normalizationObservedAt: candidate.normalizationObservedAt ?? undefined,
    url: candidate.url ?? null,
    identifier: candidate.id ?? null,
    availability: candidate.availability ?? "unknown",
    condition: candidate.condition ?? "unknown",
    marketScope:
      candidate.market === "USA"
        ? ("international" as const)
        : ("mexico" as const),
    matchScore: candidate.similarity ?? 0,
    checkedAt: candidate.observedAt,
    matchConfidence:
      (candidate.similarity ?? 0) >= 80
        ? ("high" as const)
        : (candidate.similarity ?? 0) >= 65
          ? ("medium" as const)
          : ("low" as const),
  }));
  const confidence =
    research.confidence === "HIGH"
      ? "high"
      : research.confidence === "MEDIUM"
        ? "medium"
        : research.confidence === "LOW"
          ? "low"
          : "unavailable";
  return {
    medianPriceMxn: median,
    averagePriceMxn: average,
    lowPriceMxn: ordered.length
      ? ordered[Math.floor((ordered.length - 1) * 0.2)]
      : null,
    highPriceMxn: ordered.length
      ? ordered[Math.floor((ordered.length - 1) * 0.8)]
      : null,
    sampleSize: ordered.length,
    confidence,
    source: research.resolutionSource,
    sourceUrl: candidates[0]?.url ?? null,
    checkedAt: new Date().toISOString(),
    provider: "best-round-intelligence",
    searchQuery: null,
    sources,
    excludedCount: research.excludedComparables.length,
  };
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
  const serviceClient = createServiceRoleClient();
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
  const researchInput: ResearchProductInput = {
    ...marketInput,
    category: profile?.family ?? null,
  };
  const inputFingerprint = fingerprint(marketInput);
  const configuredProvider = getConfiguredMarketPriceProvider();
  const [internalResult, savedResult] = await Promise.all([
    serviceClient
      .from("intelligence_outcome_snapshots" as never)
      .select("*")
      .eq("source", "FIRST_PARTY")
      .eq("brand", brandResult.data.name)
      .limit(50),
    serviceClient
      .from("market_price_researches")
      .select("result_snapshot, checked_at, expires_at, input_snapshot")
      .eq("brand_id", parsed.data.brandId)
      .eq("category_id", parsed.data.categoryId)
      .eq("product_condition", parsed.data.condition)
      .gt("expires_at", new Date().toISOString())
      .order("checked_at", { ascending: false })
      .limit(10),
  ]);
  const internalSales = (
    (internalResult.data ?? []) as unknown as Array<Record<string, unknown>>
  )
    .map((row) => candidateFromSnapshot(row, "BEST_ROUND_SALE"))
    .filter((value): value is ResearchCandidate => value !== null);
  const savedResearch = (
    (savedResult.data ?? []) as unknown as Array<Record<string, unknown>>
  ).flatMap((row) =>
    savedCandidates(
      row.result_snapshot,
      buildResearchFingerprint(researchInput),
    ),
  );
  const research = await researchBestRoundIntelligence(researchInput, {
    provider: configuredProvider.provider,
    internalSales,
    savedResearch,
    forceRefresh,
  });
  const economics: EconomicsCosts = {
    acquisitionCostMinor: minor(parsed.data.acquisitionCost),
    refurbishmentMinor: minor(parsed.data.conditioningCost),
    packagingMinor: minor(parsed.data.packagingCost),
    shippingMinor: minor(parsed.data.shippingSubsidy),
  };
  const decision = calculateFirstPartyDecision({ research, costs: economics });
  const marketBase = toMarketResult(research);
  const market: MarketPriceResult = {
    ...marketBase,
    medianPriceMxn: decision.marketReferenceMinor,
    lowPriceMxn: decision.marketLowMinor,
    highPriceMxn: decision.marketHighMinor,
    averagePriceMxn: decision.marketReferenceMinor,
  };
  const checkedAt = market.checkedAt ?? new Date().toISOString();
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
    requested_provider: "best-round-intelligence",
    requested_result_snapshot: {
      ...market,
      intelligenceSchemaVersion: "first-party-intelligence-v2",
      currencyNormalizationVersion: CURRENCY_NORMALIZATION_VERSION,
      comparableClassifierVersion: COMPARABLE_CLASSIFIER_VERSION,
      intelligence: { research, decision },
    },
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
    message:
      market.confidence === "unavailable"
        ? "No encontramos comparables suficientemente válidos."
        : research.cachedResearchUsed
          ? "Investigación reciente reutilizada."
          : "Best Round Intelligence actualizado.",
    researchId: recorded.data,
    market,
    fromCache: research.cachedResearchUsed,
    intelligence: { research, decision },
  };
}

export async function recordFirstPartyRecommendationAcceptanceAction(input: {
  productId: string;
  researchId: string;
  recommendedPriceMinor: number;
}): Promise<{ status: "success" | "error"; message: string }> {
  await requireCatalogManager("/operacion/catalogo");
  const parsed = z
    .object({
      productId: z.uuid(),
      researchId: z.uuid(),
      recommendedPriceMinor: z.number().int().positive(),
    })
    .safeParse(input);
  if (!parsed.success)
    return { status: "error", message: "La recomendación no es válida." };
  const client = await createClient();
  const { error } = await client.rpc(
    "record_product_pricing_recommendation_acceptance" as never,
    {
      requested_product_id: parsed.data.productId,
      requested_research_id: parsed.data.researchId,
      requested_recommended_price: parsed.data.recommendedPriceMinor,
    } as never,
  );
  return error
    ? { status: "error", message: "No pudimos registrar la aceptación." }
    : { status: "success", message: "Recomendación aceptada." };
}
