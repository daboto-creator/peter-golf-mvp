import { NextResponse } from "next/server";

import { serverEnv } from "@/env/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

const MAX_BRANDS_PER_RUN = 30;
const MAX_PAGES_PER_BRAND = 3;
const MAX_CANDIDATES_PER_BRAND = 20;
const REQUEST_TIMEOUT_MS = 8_000;
const CATEGORY_HINTS: Array<[string, string]> = [
  ["fairway", "fairway-wood"],
  ["hybrid", "hybrid"],
  ["wedge", "wedge"],
  ["putter", "putter"],
  ["iron", "iron"],
  ["driver", "driver"],
];

async function discoverOfficialModels(brand: {
  name: string;
  official_domain: string | null;
}) {
  if (!brand.official_domain)
    return [] as Array<{ model: string; category: string; url: string }>;
  const base = `https://${brand.official_domain}`;
  const urls = [base, `${base}/golf-clubs`, `${base}/golf-clubs/drivers`].slice(
    0,
    MAX_PAGES_PER_BRAND,
  );
  const found: Array<{ model: string; category: string; url: string }> = [];
  for (const url of urls) {
    if (found.length >= MAX_CANDIDATES_PER_BRAND) break;
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { accept: "text/html,application/xhtml+xml" },
      });
      if (!response.ok) continue;
      const html = (await response.text()).slice(0, 500_000);
      const names = [
        ...html.matchAll(
          /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
        ),
      ]
        .map((match) => match[1])
        .flatMap((raw) => {
          try {
            const value = JSON.parse(raw);
            return Array.isArray(value) ? value : [value];
          } catch {
            return [];
          }
        })
        .map((item) => (typeof item?.name === "string" ? item.name : ""));
      for (const name of names) {
        const text = name.trim().replace(/\s+/g, " ");
        const lower = text.toLowerCase();
        const category = CATEGORY_HINTS.find(([hint]) =>
          lower.includes(hint),
        )?.[1];
        if (!category || text.length < 2 || text.length > 160) continue;
        if (!lower.includes(brand.name.toLowerCase())) continue;
        const model = text
          .replace(new RegExp(brand.name, "ig"), "")
          .replace(
            /\b(driver|fairway wood|fairway|hybrid|iron|wedge|putter)\b/gi,
            "",
          )
          .trim();
        if (model.length < 2) continue;
        if (
          !found.some(
            (item) =>
              item.category === category &&
              item.model.toLowerCase() === model.toLowerCase(),
          )
        )
          found.push({ model, category, url });
      }
    } catch {
      // A failing manufacturer is isolated from the rest of the monthly run.
    }
  }
  return found;
}

/** Monthly bounded promotion of trusted, pre-validated discovery candidates. */
export async function GET(request: Request) {
  const expected = serverEnv.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!expected || authorization !== `Bearer ${expected}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY)
    return NextResponse.json({ error: "Refresh unavailable" }, { status: 503 });
  const supabase = createServiceRoleClient();
  // The additive reference tables are newer than generated Database types.
  // Keep this cast local until types are regenerated from staging.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: brands, error } = await db
    .from("brands")
    .select("id,name,slug,official_domain")
    .eq("status", "active")
    .limit(200);
  if (error)
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  let discovered = 0;
  let discoveryFailures = 0;
  for (const brand of (brands ?? []).slice(0, MAX_BRANDS_PER_RUN)) {
    const models = await discoverOfficialModels(brand);
    if (!models.length && brand.official_domain) discoveryFailures += 1;
    for (const item of models) {
      const normalizedBrandKey = brand.slug.replace(/-/g, "");
      const normalizedModelKey = item.model
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const { data: category } = await db
        .from("categories")
        .select("id")
        .eq("slug", item.category)
        .maybeSingle();
      if (!category?.id || !normalizedModelKey) continue;
      await db.from("golf_reference_discovery_candidates").upsert(
        {
          raw_brand: brand.name,
          raw_model: item.model,
          category_id: category.id,
          normalized_brand_key: normalizedBrandKey,
          normalized_model_key: normalizedModelKey,
          source: "OFFICIAL_MANUFACTURER",
          source_url: item.url,
          status: "VERIFIED",
          evidence: {
            discoveredBy: "jsonld",
            fetchedAt: new Date().toISOString(),
          },
        },
        { onConflict: "normalized_brand_key,normalized_model_key,category_id" },
      );
      discovered += 1;
    }
  }
  const { data: candidates, error: candidateError } = await db
    .from("golf_reference_discovery_candidates" as never)
    .select(
      "raw_brand,raw_model,category_id,normalized_brand_key,normalized_model_key,source,source_url,evidence",
    )
    .eq("status", "VERIFIED")
    .eq("source", "OFFICIAL_MANUFACTURER")
    .limit(200);
  if (candidateError)
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  const brandByKey = new Map<string, { id: string }>(
    (brands ?? []).map(
      (brand: { id: string; slug: string }) =>
        [brand.slug.replace(/-/g, ""), { id: brand.id }] as [
          string,
          { id: string },
        ],
    ),
  );
  let promoted = 0;
  for (const candidate of (candidates ?? []) as unknown as Array<
    Record<string, unknown>
  >) {
    const brand = brandByKey.get(String(candidate.normalized_brand_key ?? ""));
    const categoryId = String(candidate.category_id ?? "");
    if (!brand || !categoryId) continue;
    const { error: upsertError } = await db
      .from("catalog_product_models" as never)
      .upsert(
        {
          brand_id: brand.id,
          category_id: categoryId,
          model_name: String(candidate.raw_model ?? ""),
          normalized_model_name: String(candidate.normalized_model_key ?? ""),
          status: "active",
          lifecycle_status: "CURRENT",
          reference_priority: 1,
          reference_status: "VERIFIED",
          reference_source: String(candidate.source ?? "OFFICIAL_MANUFACTURER"),
          reference_url: candidate.source_url
            ? String(candidate.source_url)
            : null,
          last_verified_at: new Date().toISOString(),
        },
        { onConflict: "brand_id,category_id,normalized_model_name" },
      );
    if (!upsertError) promoted += 1;
  }
  return NextResponse.json({
    ok: true,
    scope: "golf-equipment",
    activeBrands: brands?.length ?? 0,
    discovered,
    promoted,
    pendingReview: 0,
    brandsChecked: Math.min(brands?.length ?? 0, MAX_BRANDS_PER_RUN),
    pagesPerBrand: MAX_PAGES_PER_BRAND,
    failures: discoveryFailures,
  });
}
