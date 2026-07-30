import { serverEnv } from "@/env/server";
import {
  checkSupabaseHealth,
  type SupabaseHealthStatus,
} from "@/lib/supabase/health";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  let status: SupabaseHealthStatus = "unavailable";

  try {
    const supabase = await createClient();
    status = await checkSupabaseHealth(supabase);
  } catch {
    // A missing configuration or client initialization error is reported only
    // as an unavailable dependency.
  }

  return Response.json(
    {
      status,
      environment: serverEnv.APP_ENV,
      timestamp: new Date().toISOString(),
      service: "supabase",
    },
    {
      status: status === "available" ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
