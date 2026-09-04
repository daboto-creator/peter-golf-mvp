import { NextResponse } from "next/server";

import { serverEnv } from "@/env/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

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
    .select("id,name,slug")
    .eq("status", "active")
    .limit(200);
  if (error)
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
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
    discovered: candidates?.length ?? 0,
    promoted,
    pendingReview: 0,
  });
}
