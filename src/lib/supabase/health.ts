import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

export type SupabaseHealthStatus = "available" | "unavailable";

export async function checkSupabaseHealth(
  client: SupabaseClient<Database>,
): Promise<SupabaseHealthStatus> {
  try {
    const { error } = await client.from("brands").select("id").limit(1);

    return error ? "unavailable" : "available";
  } catch {
    return "unavailable";
  }
}
