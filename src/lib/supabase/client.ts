"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicConfig } from "@/lib/supabase/config";
import type { Database } from "@/types/database.types";

export function createClient() {
  const { url, anonKey } = getSupabasePublicConfig();

  return createBrowserClient<Database>(url, anonKey);
}
