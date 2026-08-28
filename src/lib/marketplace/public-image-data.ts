import "server-only";

import { createClient } from "@supabase/supabase-js";

import { serverEnv } from "@/env/server";
import type { Database } from "@/types/database.types";

export async function downloadPublicMarketplaceImage(
  listingId: string,
  imageId: string,
) {
  if (
    !serverEnv.MARKETPLACE_ENABLED ||
    !serverEnv.NEXT_PUBLIC_SUPABASE_URL ||
    !serverEnv.SUPABASE_SERVICE_ROLE_KEY ||
    !["development", "test", "staging"].includes(serverEnv.APP_ENV)
  ) {
    return null;
  }
  const client = createClient<Database>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data: image, error } = await client
    .rpc("get_public_marketplace_image_path", {
      requested_image_id: imageId,
      requested_listing_id: listingId,
    })
    .maybeSingle();
  if (error || !image) return null;
  const { data: blob, error: downloadError } = await client.storage
    .from("marketplace-listing-images")
    .download(image.storage_path);
  if (downloadError || !blob) return null;
  return { blob, mimeType: image.mime_type };
}
