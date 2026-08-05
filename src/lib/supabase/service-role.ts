import "server-only";

import { createClient } from "@supabase/supabase-js";

import { serverEnv } from "@/env/server";
import type { StripeWebhookRpcInput } from "@/lib/stripe/webhook-processing";
import type { Database } from "@/types/database.types";

type RpcArgs =
  Database["public"]["Functions"]["process_stripe_webhook_event"]["Args"];

export async function processStripeWebhookEvent(input: StripeWebhookRpcInput) {
  const url = serverEnv.NEXT_PUBLIC_SUPABASE_URL;
  const key = serverEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (serverEnv.STRIPE_CHECKOUT_MODE !== "test" || !url || !key) {
    throw new Error("Stripe webhook database configuration is unavailable.");
  }

  const client = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.rpc(
    "process_stripe_webhook_event",
    input as unknown as RpcArgs,
  );
  if (error || !data[0]) {
    const code = error?.code;
    const retryable = code === "40001" || code === "40P01" || code === "P0002";
    throw new StripeWebhookDatabaseError(retryable, code);
  }
  return data[0];
}

export class StripeWebhookDatabaseError extends Error {
  constructor(
    readonly retryable: boolean,
    readonly code?: string,
  ) {
    super("Stripe webhook processing failed.");
    this.name = "StripeWebhookDatabaseError";
  }
}
