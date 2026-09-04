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
    Record<string, any>
  >) {
    const brand = brandByKey.get(candidate.normalized_brand_key);
    if (!brand || !candidate.category_id) continue;
    const { error: upsertError } = await db
      .from("catalog_product_models" as never)
      .upsert(
        {
          brand_id: brand.id,
          category_id: candidate.category_id,
          model_name: candidate.raw_model,
          normalized_model_name: candidate.normalized_model_key,
          status: "active",
          lifecycle_status: "CURRENT",
          reference_priority: 1,
          reference_status: "VERIFIED",
          reference_source: candidate.source,
          reference_url: candidate.source_url,
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
