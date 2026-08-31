"use server";

import { createHash } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  requireMarketplacePricingManager,
  requireVerifiedMarketplacePartner,
} from "@/lib/auth/marketplace-authorization";
import { parseMoneyToMinorUnits } from "@/lib/catalog/product-validation";
import type { PartnerActionState } from "@/lib/marketplace/partner-action-state";
import { normalizeMarketplaceMarketResult } from "@/lib/pricing/marketplace-market-intelligence";
import type { MarketPriceInput } from "@/lib/pricing/market-price-provider";
import { researchMarketPriceSafely } from "@/lib/pricing/market-price-resilience";
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
      "id, listing_id, listing_version_id, listing_version:marketplace_listing_versions!marketplace_market_analysis_listing_version_fk(condition, condition_grade, specifications, brands(name), catalog_product_models(model_name), categories(category_spec_profiles(family, club_type, bag_type, set_type)))",
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
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
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
      requested_result_snapshot: cachedResult.data,
      requested_comparables: cachedResult.data.comparables,
      requested_excluded_count: cached.data.excluded_comparable_count,
    });
    if (completed.error) return failure(completed.error.message);
    revalidatePath("/operacion/marketplace/precios");
    revalidatePath(`/partner/publicaciones/${analysis.data.listing_id}/precio`);
    return { status: "success", message: "Referencia reciente reutilizada." };
  }
  const researched = await researchMarketPriceSafely(input, {
    provider: configured.provider,
    forceRefresh: true,
    failureProviderName: configured.name,
  });
  const normalized = normalizeMarketplaceMarketResult(researched.result);
  const completed = await client.rpc("complete_marketplace_market_analysis", {
    requested_analysis_id: analysisId.data,
    requested_provider: researched.result.provider,
    requested_provider_status: researched.failed ? "unavailable" : "complete",
    requested_input_fingerprint: fingerprint,
    requested_input_snapshot: input,
    requested_result_snapshot: normalized,
    requested_comparables: normalized.comparables,
    requested_excluded_count: researched.result.excludedCount,
  });
  if (completed.error) return failure(completed.error.message);
  revalidatePath("/operacion/marketplace/precios");
  revalidatePath(`/partner/publicaciones/${analysis.data.listing_id}/precio`);
  return {
    status: "success",
    message: researched.failed
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
