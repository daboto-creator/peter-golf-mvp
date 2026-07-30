import { publicEnv } from "@/env/public";

export function getSupabasePublicConfig() {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase public configuration is unavailable.");
  }

  return { url, anonKey };
}
