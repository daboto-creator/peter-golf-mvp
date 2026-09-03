import { NextResponse } from "next/server";

import { serverEnv } from "@/env/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

/**
 * Monthly, bounded refresh seam. Discovery providers are deliberately injected
 * later; this endpoint currently inventories the active canonical scope without
 * promoting arbitrary web data into master records.
 */
export async function GET(request: Request) {
  const expected = serverEnv.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!expected || authorization !== `Bearer ${expected}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY)
    return NextResponse.json({ error: "Refresh unavailable" }, { status: 503 });
  const supabase = createServiceRoleClient();
  const { data: brands, error } = await supabase
    .from("brands")
    .select("id,name")
    .eq("status", "active")
    .limit(200);
  if (error)
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  return NextResponse.json({
    ok: true,
    scope: "golf-equipment",
    activeBrands: brands?.length ?? 0,
    discovered: 0,
    promoted: 0,
    pendingReview: 0,
  });
}
