import { NextResponse } from "next/server";

import { serverEnv } from "@/env/server";
import {
  GOLF_REFERENCE_CATEGORIES,
  runGolfReferenceDiscovery,
  type CanonicalGolfModel,
  type DiscoveryBrand,
} from "@/lib/catalog/golf-reference-discovery";
import { SerpApiOfficialSearchProvider } from "@/lib/pricing/serpapi-official-search-provider";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BRANDS_PER_RUN = 30;
const MAX_MANUAL_BRANDS = 5;

function requestedBrandSlugs(request: Request): string[] {
  const raw = new URL(request.url).searchParams.get("brands");
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter((value) => /^[a-z0-9-]+$/.test(value)),
    ),
  ].slice(0, MAX_MANUAL_BRANDS);
}

/** Monthly bounded discovery from configured official manufacturer domains. */
export async function GET(request: Request) {
  const startedAt = Date.now();
  const expected = serverEnv.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!expected || authorization !== `Bearer ${expected}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY)
    return NextResponse.json({ error: "Refresh unavailable" }, { status: 503 });

  const requestUrl = new URL(request.url);
  const requestedSlugs = requestedBrandSlugs(request);
  if (requestUrl.searchParams.has("brands") && !requestedSlugs.length)
    return NextResponse.json({ error: "Invalid brand scope" }, { status: 400 });
  const force = requestUrl.searchParams.get("force") === "1";
  const supabase = createServiceRoleClient();
  // These additive reference tables are newer than generated Database types.
  // Keep the cast local until types are regenerated from staging.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  let brandQuery = db
    .from("brands")
    .select("id,name,slug,official_domain,last_verified_at")
    .eq("status", "active")
    .not("official_domain", "is", null)
    .order("created_at", { ascending: true })
    .limit(MAX_BRANDS_PER_RUN);
  if (requestedSlugs.length) brandQuery = brandQuery.in("slug", requestedSlugs);
  const [brandResult, categoryResult, canonicalResult] = await Promise.all([
    brandQuery,
    db
      .from("categories")
      .select("id,name,slug")
      .in(
        "slug",
        GOLF_REFERENCE_CATEGORIES.map((category) => category.slug),
      )
      .eq("status", "active"),
    db
      .from("catalog_product_models")
      .select("id,brand_id,category_id,normalized_model_name")
      .eq("status", "active"),
  ]);
  if (brandResult.error || categoryResult.error || canonicalResult.error)
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });

  const categoriesBySlug = new Map(
    (categoryResult.data ?? []).map(
      (category: { id: string; name: string; slug: string }) => [
        category.slug,
        category,
      ],
    ),
  );
  const categories = GOLF_REFERENCE_CATEGORIES.flatMap((category) => {
    const stored = categoriesBySlug.get(category.slug) as
      { id: string } | undefined;
    return stored ? [{ ...category, id: stored.id }] : [];
  });
  if (categories.length !== GOLF_REFERENCE_CATEGORIES.length)
    return NextResponse.json(
      { error: "Refresh taxonomy unavailable" },
      { status: 500 },
    );

  const categorySlugById = new Map(
    [...categoriesBySlug.entries()].map(([slug, category]) => [
      (category as { id: string }).id,
      slug,
    ]),
  );
  const brands: DiscoveryBrand[] = (brandResult.data ?? []).map(
    (brand: Record<string, unknown>) => ({
      id: String(brand.id),
      name: String(brand.name),
      slug: String(brand.slug),
      officialDomain: String(brand.official_domain),
      lastVerifiedAt: brand.last_verified_at
        ? String(brand.last_verified_at)
        : null,
    }),
  );
  if (requestedSlugs.length && brands.length !== requestedSlugs.length)
    return NextResponse.json({ error: "Unknown brand scope" }, { status: 400 });
  const canonicalModels: CanonicalGolfModel[] = (
    canonicalResult.data ?? []
  ).flatMap((model: Record<string, unknown>) => {
    const categorySlug = categorySlugById.get(String(model.category_id));
    return categorySlug
      ? [
          {
            id: String(model.id),
            brandId: String(model.brand_id),
            categoryId: String(model.category_id),
            categorySlug,
            normalizedModelName: String(model.normalized_model_name),
          },
        ]
      : [];
  });
  const searchProvider =
    serverEnv.MARKET_PRICE_PROVIDER === "serpapi" && serverEnv.SERPAPI_API_KEY
      ? new SerpApiOfficialSearchProvider(serverEnv.SERPAPI_API_KEY)
      : null;
  const discovery = await runGolfReferenceDiscovery({
    brands,
    categories,
    canonicalModels,
    searchProvider,
    force,
  });

  let verifiedPromotions = 0;
  let persistenceErrors = 0;
  for (const item of discovery.discoveries) {
    if (item.decision === "EXISTING" && item.canonicalId) {
      const { error } = await db
        .from("catalog_product_models")
        .update({
          reference_status: "VERIFIED",
          reference_source: "OFFICIAL_MANUFACTURER",
          reference_url: item.sourceUrl,
          last_verified_at: new Date().toISOString(),
        })
        .eq("id", item.canonicalId);
      if (error) persistenceErrors += 1;
      continue;
    }
    const candidateStatus =
      item.decision === "VERIFIED" ? "VERIFIED" : "NEEDS_REVIEW";
    const { error: candidateError } = await db
      .from("golf_reference_discovery_candidates")
      .upsert(
        {
          raw_brand: item.brandName,
          raw_model: item.modelName,
          category_id: item.categoryId,
          normalized_brand_key: item.brandKey,
          normalized_model_key: item.normalizedModelName,
          source: "OFFICIAL_MANUFACTURER",
          source_url: item.sourceUrl,
          status: candidateStatus,
          evidence: item.evidence,
        },
        { onConflict: "normalized_brand_key,normalized_model_key,category_id" },
      );
    if (candidateError) {
      persistenceErrors += 1;
      continue;
    }
    if (item.decision !== "VERIFIED") continue;
    const { error: promotionError } = await db
      .from("catalog_product_models")
      .upsert(
        {
          brand_id: item.brandId,
          category_id: item.categoryId,
          model_name: item.modelName,
          normalized_model_name: item.normalizedModelName,
          status: "active",
          lifecycle_status: "CURRENT",
          reference_priority: 1,
          reference_status: "VERIFIED",
          reference_source: "OFFICIAL_MANUFACTURER",
          reference_url: item.sourceUrl,
          last_verified_at: new Date().toISOString(),
        },
        { onConflict: "brand_id,category_id,normalized_model_name" },
      );
    if (promotionError) persistenceErrors += 1;
    else verifiedPromotions += 1;
  }
  for (const result of discovery.brands) {
    if (result.status !== "SUCCESS") continue;
    const brand = brands.find((value) => value.name === result.brand);
    if (!brand) continue;
    const { error } = await db
      .from("brands")
      .update({ last_verified_at: new Date().toISOString() })
      .eq("id", brand.id);
    if (error) persistenceErrors += 1;
  }

  return NextResponse.json({
    ok: persistenceErrors === 0,
    scope: "golf-equipment",
    mode: requestedSlugs.length ? "bounded-manual" : "monthly",
    searchProvider: searchProvider ? "serpapi" : "unavailable",
    requestedBrands: requestedSlugs,
    ...discovery.summary,
    verifiedPromotions,
    persistenceErrors,
    durationMs: Date.now() - startedAt,
    brands: discovery.brands,
    diagnostics: discovery.diagnostics,
  });
}
