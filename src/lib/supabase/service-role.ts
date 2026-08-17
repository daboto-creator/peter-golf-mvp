import "server-only";

import { createClient } from "@supabase/supabase-js";

import { serverEnv } from "@/env/server";
import type { StripeWebhookRpcInput } from "@/lib/stripe/webhook-processing";
import {
  isPermanentStripeWebhookDatabaseError,
  toStripeWebhookRpcArgs,
} from "@/lib/stripe/webhook-rpc";
import type { Database } from "@/types/database.types";

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
    toStripeWebhookRpcArgs(input),
  );
  if (error || !data[0]) {
    const code = error?.code;
    const hintCode = error?.hint;
    const permanent = isPermanentStripeWebhookDatabaseError(code, hintCode);
    throw new StripeWebhookDatabaseError(!permanent, code, hintCode);
  }
  return data[0];
}

export class StripeWebhookDatabaseError extends Error {
  constructor(
    readonly retryable: boolean,
    readonly code?: string,
    readonly hintCode?: string,
  ) {
    super("Stripe webhook processing failed.");
    this.name = "StripeWebhookDatabaseError";
  }
}
