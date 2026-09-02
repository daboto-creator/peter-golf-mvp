"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  requireMarketplacePricingManager,
  requireVerifiedMarketplacePartner,
} from "@/lib/auth/marketplace-authorization";
import { parseMoneyToMinorUnits } from "@/lib/catalog/product-validation";
import type { PartnerActionState } from "@/lib/marketplace/partner-action-state";
import type { Json } from "@/types/database.types";
import {
  buildResearchFingerprint,
  researchBestRoundIntelligence,
  type ResearchProductInput,
} from "@/lib/pricing/intelligence-research";
import { summarizeResearchMarket } from "@/lib/pricing/intelligence-economics";
import type { MarketPriceInput } from "@/lib/pricing/market-price-provider";
import { getConfiguredMarketPriceProvider } from "@/lib/pricing/market-price-service";

const uuid = z.uuid();
const positiveVersion = z.coerce.number().int().positive();
const cachedComparableSchema = z.object({
  source: z.string(),
  title: z.string(),
  seller: z.string(),
  priceMinor: z.number().int().positive(),
  condition: z.enum(["new", "used", "refurbished", "unknown"]),
  availability: z.enum(["in_stock", "out_of_stock", "unknown"]),
  referenceUrl: z.string().url().nullable(),
  matchScore: z.number().int().min(0).max(100),
  matchReasons: z.array(z.string()),
  observedAt: z.string(),
  market: z.string().optional(),
  sourceQualityScore: z.number().int().min(0).max(100).optional(),
  marketPriorityScore: z.number().int().min(0).max(100).optional(),
  recencyScore: z.number().int().min(0).max(100).optional(),
  finalEvidenceScore: z.number().int().min(0).max(100).optional(),
});
const cachedAnalysisSchema = z.object({
  status: z.enum(["COMPLETE", "INSUFFICIENT_DATA", "PROVIDER_UNAVAILABLE"]),
  validComparableCount: z.number().int().nonnegative(),
  medianPriceMinor: z.number().int().positive().nullable(),
  averagePriceMinor: z.number().int().positive().nullable(),
  lowMarketMinor: z.number().int().positive().nullable(),
  highMarketMinor: z.number().int().positive().nullable(),
  recommendedPriceMinor: z.number().int().positive().nullable(),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW", "INSUFFICIENT"]),
  flags: z.array(z.string()),
  analysisVersion: z.string(),
  comparables: z.array(cachedComparableSchema),
  researchMetadata: z.record(z.string(), z.unknown()).optional(),
});

function value(formData: FormData, key: string): string {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry.trim() : "";
}

function failure(message: string): PartnerActionState {
  if (message.includes("version conflict"))
    return {
      status: "error",
      message: "La cotización cambió. Actualiza la página para continuar.",
    };
  if (message.includes("approved listing version"))
    return {
      status: "error",
      message: "El pricing sólo puede calcularse para la versión aprobada.",
    };
  if (message.includes("access denied") || message.includes("denied"))
    return { status: "error", message: "No tienes permiso para esta acción." };
  return {
    status: "error",
    message: "No pudimos completar la acción de pricing.",
  };
}

function optionalMoney(raw: string): number | null {
  if (!raw) return null;
  return parseMoneyToMinorUnits(raw);
}

export async function prepareMarketplaceListingPriceAction(
  _previous: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const listingId = uuid.safeParse(value(formData, "listing_id"));
  const lockVersion = positiveVersion.safeParse(
    value(formData, "lock_version"),
  );
  const analysisId = z
    .union([z.uuid(), z.literal("")])
    .safeParse(value(formData, "market_analysis_id"));
  const idempotencyKey = uuid.safeParse(value(formData, "idempotency_key"));
  const desiredPublicPrice = optionalMoney(
    value(formData, "desired_public_price"),
  );
  if (
    !listingId.success ||
    !lockVersion.success ||
    !analysisId.success ||
    !idempotencyKey.success ||
    !desiredPublicPrice
  )
    return { status: "error", message: "Indica un precio de venta válido." };
  const { client } = await requireVerifiedMarketplacePartner(
    `/partner/publicaciones/${listingId.data}/precio`,
  );
  const result = await client.rpc("prepare_marketplace_listing_price", {
    requested_listing_id: listingId.data,
    expected_lock_version: lockVersion.data,
    requested_desired_public_price: desiredPublicPrice,
    requested_market_analysis_id: analysisId.data || null,
    requested_idempotency_key: idempotencyKey.data,
  });
  if (result.error) return failure(result.error.message);
  revalidatePath(`/partner/publicaciones/${listingId.data}/precio`);
  revalidatePath(`/partner/publicaciones/${listingId.data}/revision`);
  return {
    status: "success",
    message: "Precio y resultado financiero guardados.",
  };
}

export async function requestMarketplaceAnalysisAction(
  _previous: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const listingId = uuid.safeParse(value(formData, "listing_id"));
  const versionId = uuid.safeParse(value(formData, "listing_version_id"));
  const idempotencyKey = uuid.safeParse(value(formData, "idempotency_key"));
  if (!listingId.success || !versionId.success || !idempotencyKey.success)
    return { status: "error", message: "Solicitud de mercado inválida." };
  const { client } = await requireVerifiedMarketplacePartner(
    `/partner/publicaciones/${listingId.data}/precio`,
  );
  const result = await client.rpc("request_marketplace_market_analysis", {
    requested_listing_id: listingId.data,
    requested_listing_version_id: versionId.data,
    requested_idempotency_key: idempotencyKey.data,
  });
  if (result.error) return failure(result.error.message);
  revalidatePath(`/partner/publicaciones/${listingId.data}/precio`);
  return {
    status: "success",
    message:
      "Solicitud recibida. Best Round actualizará la referencia sin bloquear tu cálculo de cargos.",
  };
}

export async function requestMarketplaceAnalysisForOperationsAction(
  _previous: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const listingId = uuid.safeParse(value(formData, "listing_id"));
  const versionId = uuid.safeParse(value(formData, "listing_version_id"));
  const idempotencyKey = uuid.safeParse(value(formData, "idempotency_key"));
  if (!listingId.success || !versionId.success || !idempotencyKey.success)
    return { status: "error", message: "Solicitud de mercado inválida." };
  const { client } = await requireMarketplacePricingManager(
    "/operacion/marketplace/precios",
  );
  const result = await client.rpc("request_marketplace_market_analysis", {
    requested_listing_id: listingId.data,
    requested_listing_version_id: versionId.data,
    requested_idempotency_key: idempotencyKey.data,
  });
  if (result.error) return failure(result.error.message);
  revalidatePath("/operacion/marketplace/precios");
  revalidatePath(`/partner/publicaciones/${listingId.data}/precio`);
  return {
    status: "success",
    message: "Actualización solicitada; queda disponible en la cola segura.",
  };
}

export async function createMarketplacePricingQuoteAction(
  _previous: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const listingId = uuid.safeParse(value(formData, "listing_id"));
  const versionId = uuid.safeParse(value(formData, "listing_version_id"));
  const analysisId = z
    .union([z.uuid(), z.literal("")])
    .safeParse(value(formData, "market_analysis_id"));
  const idempotencyKey = uuid.safeParse(value(formData, "idempotency_key"));
  const inputMode = z
    .enum(["PUBLIC_PRICE_PRIORITY", "NET_PRIORITY"])
    .safeParse(value(formData, "input_mode"));
  const desiredPublicPrice = optionalMoney(
    value(formData, "desired_public_price"),
  );
  const desiredPartnerNet = optionalMoney(
    value(formData, "desired_partner_net"),
  );
  if (
    !listingId.success ||
    !versionId.success ||
    !analysisId.success ||
    !idempotencyKey.success ||
    !inputMode.success ||
    (inputMode.data === "PUBLIC_PRICE_PRIORITY" && !desiredPublicPrice) ||
    (inputMode.data === "NET_PRIORITY" && !desiredPartnerNet)
  )
    return {
      status: "error",
      message: "Indica un precio o neto válido y cuál tiene prioridad.",
    };
  const { client } = await requireVerifiedMarketplacePartner(
    `/partner/publicaciones/${listingId.data}/precio`,
  );
  const result = await client.rpc("create_marketplace_pricing_quote", {
    requested_listing_id: listingId.data,
    requested_listing_version_id: versionId.data,
    requested_input_mode: inputMode.data,
    requested_desired_public_price: desiredPublicPrice,
    requested_desired_partner_net: desiredPartnerNet,
    requested_market_analysis_id: analysisId.data || null,
    requested_idempotency_key: idempotencyKey.data,
  });
  if (result.error) return failure(result.error.message);
  revalidatePath(`/partner/publicaciones/${listingId.data}/precio`);
  return {
    status: "success",
    message: "Economía calculada con reglas vigentes y snapshot inmutable.",
  };
}

export async function transitionMarketplacePricingAction(
  _previous: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const quoteId = uuid.safeParse(value(formData, "quote_id"));
  const listingId = uuid.safeParse(value(formData, "listing_id"));
  const lockVersion = positiveVersion.safeParse(
    value(formData, "lock_version"),
  );
  const status = z
    .enum([
      "PARTNER_ACCEPTED",
      "UNDER_REVIEW",
      "CHANGES_REQUESTED",
      "APPROVED",
      "REJECTED",
    ])
    .safeParse(value(formData, "status"));
  const reason = value(formData, "reason");
  if (
    !quoteId.success ||
    !listingId.success ||
    !lockVersion.success ||
    !status.success
  )
    return { status: "error", message: "Acción de pricing inválida." };
  const operations = ["CHANGES_REQUESTED", "APPROVED", "REJECTED"].includes(
    status.data,
  );
  const context = operations
    ? await requireMarketplacePricingManager(
        `/operacion/marketplace/precios/${quoteId.data}`,
      )
    : await requireVerifiedMarketplacePartner(
        `/partner/publicaciones/${listingId.data}/precio`,
      );
  if (operations && reason.length < 3)
    return { status: "error", message: "Indica el motivo de la decisión." };
  const result = await context.client.rpc(
    "transition_marketplace_pricing_quote",
    {
      requested_quote_id: quoteId.data,
      expected_lock_version: lockVersion.data,
      requested_status: status.data,
      requested_reason: reason || null,
    },
  );
  if (result.error) return failure(result.error.message);
  revalidatePath(`/partner/publicaciones/${listingId.data}/precio`);
  revalidatePath(`/operacion/marketplace/precios/${quoteId.data}`);
  revalidatePath("/operacion/marketplace/precios");
  return { status: "success", message: "Workflow de pricing actualizado." };
}

function stringSpec(
  specifications: Readonly<Record<string, unknown>>,
  key: string,
): string | null {
  const result = specifications[key];
  return typeof result === "string" && result.trim() ? result.trim() : null;
}

function numberSpec(
  specifications: Readonly<Record<string, unknown>>,
  key: string,
): number | null {
  const result = specifications[key];
  return typeof result === "number" && Number.isFinite(result) ? result : null;
}

type ResearchEvidenceRow = {
  title?: string | null;
  seller?: string | null;
  price?: number | null;
  observedAt?: string | null;
  product?: Record<string, unknown>;
};

function candidateFromSnapshot(
  snapshot: Record<string, unknown>,
  market: "BEST_ROUND_SALE" | "SAVED_RESEARCH",
): ResearchEvidenceRow | null {
  const price = Number(
    snapshot.publicUnitPrice ?? snapshot.priceMinor ?? snapshot.unitPrice,
  );
  const title = String(snapshot.listingTitle ?? snapshot.title ?? "").trim();
  if (!title || !Number.isSafeInteger(price) || price <= 0) return null;
  return {
    title,
    seller:
      market === "BEST_ROUND_SALE" ? "Best Round" : "Investigación guardada",
    price,
    observedAt: String(
      snapshot.observedAt ??
        snapshot.checkedAt ??
        snapshot.createdAt ??
        new Date().toISOString(),
    ),
    product: (snapshot.specificationsSnapshot ??
      snapshot.inputSnapshot ??
      {}) as Record<string, unknown>,
  };
}

async function loadResearchEvidence(
  client: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  canonicalModelId: string,
): Promise<{
  internalSales: ResearchEvidenceRow[];
  savedResearch: ResearchEvidenceRow[];
}> {
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const [sales, firstPartySales, analyses] = await Promise.all([
    client
      .from("marketplace_order_item_snapshots")
      .select(
        "listing_title, public_unit_price, specifications_snapshot, created_at, order_items!inner(item_source, orders!inner(status))",
      )
      .eq("canonical_product_model_id", canonicalModelId)
      .eq("order_items.item_source", "MARKETPLACE_PARTNER")
      .eq("order_items.orders.status", "delivered")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10),
    client
      .from("order_items")
      .select(
        "product_name_snapshot, unit_price_snapshot, created_at, item_source, orders!inner(status)",
      )
      .eq("item_source", "FIRST_PARTY")
      .eq("orders.status", "delivered")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10),
    client
      .from("marketplace_market_analyses")
      .select("result_snapshot, checked_at, status, canonical_product_model_id")
      .eq("canonical_product_model_id", canonicalModelId)
      .eq("status", "COMPLETE")
      .gte("checked_at", since)
      .order("checked_at", { ascending: false })
      .limit(10),
  ]);
  const internalSales = (sales.data ?? []).flatMap((row) => {
    const value = row as unknown as Record<string, unknown>;
    return (
      candidateFromSnapshot(
        {
          title: value.listing_title,
          publicUnitPrice: value.public_unit_price,
          specificationsSnapshot: value.specifications_snapshot,
          createdAt: value.created_at,
        },
        "BEST_ROUND_SALE",
      ) ?? []
    );
  });
  internalSales.push(
    ...(firstPartySales.data ?? []).flatMap((row) => {
      const value = row as unknown as Record<string, unknown>;
      return (
        candidateFromSnapshot(
          {
            title: value.product_name_snapshot,
            publicUnitPrice: value.unit_price_snapshot,
            createdAt: value.created_at,
          },
          "BEST_ROUND_SALE",
        ) ?? []
      );
    }),
  );
  const savedResearch = (analyses.data ?? []).flatMap((row) => {
    const value = row as unknown as Record<string, unknown>;
    const snapshot = value.result_snapshot as Record<string, unknown> | null;
    const comparables = Array.isArray(snapshot?.comparables)
      ? snapshot.comparables
      : [];
    return comparables.flatMap((item) => {
      const comparable = item as Record<string, unknown>;
      return (
        candidateFromSnapshot(
          { ...comparable, checkedAt: value.checked_at },
          "SAVED_RESEARCH",
        ) ?? []
      );
    });
  });
  return { internalSales, savedResearch };
}

export async function completeMarketplaceAnalysisAction(
  _previous: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const analysisId = uuid.safeParse(value(formData, "analysis_id"));
  if (!analysisId.success)
    return { status: "error", message: "Análisis inválido." };
  const { client } = await requireMarketplacePricingManager(
    "/operacion/marketplace/precios",
  );
  const analysis = await client
    .from("marketplace_market_analyses")
    .select(
      "id, listing_id, listing_version_id, listing_version:marketplace_listing_versions!marketplace_market_analysis_listing_version_fk(condition, condition_grade, specifications, brands(name), catalog_product_models(id, model_name), categories(category_spec_profiles(family, club_type, bag_type, set_type)))",
    )
    .eq("id", analysisId.data)
    .eq("status", "REQUESTED")
    .maybeSingle();
  const version = analysis.data?.listing_version;
  if (!analysis.data || !version)
    return { status: "error", message: "La solicitud ya no está disponible." };
  const specifications =
    version.specifications && typeof version.specifications === "object"
      ? (version.specifications as Record<string, unknown>)
      : {};
  const profile = version.categories?.category_spec_profiles;
  const input: MarketPriceInput = {
    brand: version.brands?.name ?? null,
    model: version.catalog_product_models?.model_name ?? null,
    modelYear: numberSpec(specifications, "model_year"),
    productFamily: profile?.family ?? null,
    clubType: profile?.club_type ?? null,
    clubNumber: stringSpec(specifications, "club_number"),
    setType: profile?.set_type ?? null,
    bagType: profile?.bag_type ?? null,
    loftDegrees: numberSpec(specifications, "loft_degrees"),
    handedness: stringSpec(specifications, "handedness"),
    shaftMaterial: stringSpec(specifications, "shaft_material"),
    shaftBrand: stringSpec(specifications, "shaft_brand"),
    shaftModel: stringSpec(specifications, "shaft_model"),
    shaftFlex: stringSpec(specifications, "shaft_flex"),
    condition: version.condition ?? "used",
    conditionGrade: version.condition_grade,
    conditionScore: null,
    targetPlayer: stringSpec(specifications, "target_player"),
    market: "MX",
  };
  if (!input.brand || !input.model)
    return {
      status: "error",
      message: "La versión aprobada no tiene identidad canónica completa.",
    };
  const configured = getConfiguredMarketPriceProvider();
  const fingerprint = buildResearchFingerprint(input as ResearchProductInput);
  const cached = await client
    .from("marketplace_market_analyses")
    .select(
      "provider, provider_status, result_snapshot, excluded_comparable_count",
    )
    .eq("input_fingerprint", fingerprint)
    .eq("provider", configured.name)
    .eq("status", "COMPLETE")
    .gt("expires_at", new Date().toISOString())
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const cachedResult = cachedAnalysisSchema.safeParse(
    cached.data?.result_snapshot,
  );
  if (!cached.error && cached.data && cachedResult.success) {
    const completed = await client.rpc("complete_marketplace_market_analysis", {
      requested_analysis_id: analysisId.data,
      requested_provider: cached.data.provider ?? configured.name,
      requested_provider_status: "cache_hit",
      requested_input_fingerprint: fingerprint,
      requested_input_snapshot: input,
      requested_result_snapshot: cachedResult.data as unknown as Json,
      requested_comparables: cachedResult.data.comparables,
      requested_excluded_count: cached.data.excluded_comparable_count,
    });
    if (completed.error) return failure(completed.error.message);
    revalidatePath("/operacion/marketplace/precios");
    revalidatePath(`/partner/publicaciones/${analysis.data.listing_id}/precio`);
    return { status: "success", message: "Referencia reciente reutilizada." };
  }
  const evidence = version.catalog_product_models?.id
    ? await loadResearchEvidence(client, version.catalog_product_models.id)
    : { internalSales: [], savedResearch: [] };
  const researched = await researchBestRoundIntelligence(
    input as ResearchProductInput,
    {
      provider: configured.provider,
      forceRefresh: false,
      internalSales: evidence.internalSales.map((candidate) => ({
        title: candidate.title!,
        seller: candidate.seller ?? "Best Round",
        priceMinor: candidate.price!,
        market: "BEST_ROUND_SALE" as const,
        source: "Best Round",
        observedAt: candidate.observedAt!,
        product: candidate.product,
      })),
      savedResearch: evidence.savedResearch.map((candidate) => ({
        title: candidate.title!,
        seller: candidate.seller ?? "Investigación guardada",
        priceMinor: candidate.price!,
        market: "SAVED_RESEARCH" as const,
        source: "saved-research",
        observedAt: candidate.observedAt!,
        product: candidate.product,
      })),
    },
  );
  const normalized = {
    status:
      researched.status === "COMPLETE"
        ? ("COMPLETE" as const)
        : researched.status === "PROVIDER_UNAVAILABLE"
          ? ("PROVIDER_UNAVAILABLE" as const)
          : ("INSUFFICIENT_DATA" as const),
    validComparableCount: researched.acceptedComparables.length,
    medianPriceMinor: researched.acceptedComparables.length
      ? Math.round(
          researched.acceptedComparables
            .map((item) => item.priceMinor)
            .sort((a, b) => a - b)[
            Math.floor(researched.acceptedComparables.length / 2)
          ],
        )
      : null,
    averagePriceMinor: researched.acceptedComparables.length
      ? Math.round(
          researched.acceptedComparables.reduce(
            (sum, item) => sum + item.priceMinor,
            0,
          ) / researched.acceptedComparables.length,
        )
      : null,
    lowMarketMinor: researched.acceptedComparables.length
      ? Math.min(
          ...researched.acceptedComparables.map((item) => item.priceMinor),
        )
      : null,
    highMarketMinor: researched.acceptedComparables.length
      ? Math.max(
          ...researched.acceptedComparables.map((item) => item.priceMinor),
        )
      : null,
    recommendedPriceMinor: researched.acceptedComparables.length
      ? Math.round(
          researched.acceptedComparables
            .map((item) => item.priceMinor)
            .sort((a, b) => a - b)[
            Math.floor(researched.acceptedComparables.length / 2)
          ],
        )
      : null,
    confidence: researched.confidence,
    flags: researched.reasons,
    analysisVersion: researched.engineVersion,
    researchMetadata: {
      resolutionSource: researched.resolutionSource,
      evidenceLevel: researched.evidenceLevel,
      internalSalesUsed: researched.internalSalesUsed,
      cachedResearchUsed: researched.cachedResearchUsed,
      mexicoQueriesExecuted: researched.mexicoQueriesExecuted,
      usaQueriesExecuted: researched.usaQueriesExecuted,
      excludedComparables: researched.excludedComparables.map((item) => ({
        exclusion: item.exclusion,
        title: item.title,
      })),
      marketSummary: summarizeResearchMarket(researched),
      economicsEngineReady: true,
    },
    comparables: researched.acceptedComparables.map((item) => ({
      source: item.source,
      title: item.title,
      brand: null,
      model: null,
      category: null,
      condition: item.condition ?? "unknown",
      priceMinor: item.priceMinor,
      currency: "MXN" as const,
      seller: item.seller,
      referenceUrl: item.url ?? null,
      availability: item.availability ?? "unknown",
      shippingMinor: null,
      totalPriceMinor: null,
      matchScore: item.similarity ?? 0,
      matchReasons: item.similarityReasons ?? [],
      observedAt: item.observedAt,
      market: item.market,
      sourceQualityScore: item.sourceQuality,
      marketPriorityScore: item.marketPriorityScore,
      recencyScore: item.recencyScore,
      finalEvidenceScore: item.evidenceScore,
    })),
  };
  const completed = await client.rpc("complete_marketplace_market_analysis", {
    requested_analysis_id: analysisId.data,
    requested_provider: configured.name,
    requested_provider_status: researched.providerUnavailable
      ? "unavailable"
      : "complete",
    requested_input_fingerprint: fingerprint,
    requested_input_snapshot: input,
    requested_result_snapshot: normalized as unknown as Json,
    requested_comparables: normalized.comparables,
    requested_excluded_count: researched.excludedComparables.length,
  });
  if (completed.error) return failure(completed.error.message);
  revalidatePath("/operacion/marketplace/precios");
  revalidatePath(`/partner/publicaciones/${analysis.data.listing_id}/precio`);
  return {
    status: "success",
    message: researched.providerUnavailable
      ? "Provider no disponible; la solicitud quedó lista para referencia manual."
      : "Referencia de mercado actualizada.",
  };
}

export async function createManualMarketplaceReferenceAction(
  _previous: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const listingId = uuid.safeParse(value(formData, "listing_id"));
  const versionId = uuid.safeParse(value(formData, "listing_version_id"));
  const idempotencyKey = uuid.safeParse(value(formData, "idempotency_key"));
  const reference = optionalMoney(value(formData, "reference_price"));
  const low = optionalMoney(value(formData, "low_market"));
  const high = optionalMoney(value(formData, "high_market"));
  const source = value(formData, "source_description");
  const reason = value(formData, "reason");
  if (
    !listingId.success ||
    !versionId.success ||
    !idempotencyKey.success ||
    !reference ||
    source.length < 3 ||
    reason.length < 3
  )
    return { status: "error", message: "Completa la referencia y el motivo." };
  const { client } = await requireMarketplacePricingManager(
    "/operacion/marketplace/precios",
  );
  const result = await client.rpc(
    "create_marketplace_manual_market_reference",
    {
      requested_listing_id: listingId.data,
      requested_listing_version_id: versionId.data,
      requested_reference_price: reference,
      requested_low_market: low,
      requested_high_market: high,
      requested_source_description: source,
      requested_reason: reason,
      requested_idempotency_key: idempotencyKey.data,
    },
  );
  if (result.error) return failure(result.error.message);
  revalidatePath(`/partner/publicaciones/${listingId.data}/precio`);
  revalidatePath("/operacion/marketplace/precios");
  return { status: "success", message: "Referencia manual auditada." };
}
