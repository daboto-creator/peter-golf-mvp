import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

export type PublicFirstPartySellableRow = {
  product_id: string;
  slug: string;
  name: string;
  brand_name: string;
  model_name: string;
  category_name: string;
  product_family: string | null;
  club_type: string | null;
  set_type: string | null;
  condition: string;
  price: number | string;
  currency: string;
  available_quantity: number;
  technical_specs: Json;
};

export async function loadPublicFirstPartySellableInventory() {
  const client = await createClient();
  const result = await client.rpc("get_public_first_party_sellable_inventory");
  return {
    data: result.data as PublicFirstPartySellableRow[] | null,
    error: result.error,
  };
}
