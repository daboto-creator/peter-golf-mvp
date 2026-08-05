import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { serverEnv } from "@/env/server";
import { getStripeClient } from "@/lib/stripe/server";
import { normalizeStripeWebhookEvent } from "@/lib/stripe/webhook-processing";
import {
  processStripeWebhookEvent,
  StripeWebhookDatabaseError,
} from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (
    serverEnv.STRIPE_CHECKOUT_MODE !== "test" ||
    !serverEnv.STRIPE_WEBHOOK_SECRET
  ) {
    return response("disabled", 503);
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return response("invalid_signature", 400);

  const rawBody = await request.text();
  let event;
  try {
    event = getStripeClient().webhooks.constructEvent(
      rawBody,
      signature,
      serverEnv.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return response("invalid_signature", 400);
  }

  if (event.livemode) return response("live_mode_forbidden", 400);
  const payloadHash = createHash("sha256").update(rawBody).digest("hex");
  const normalized = normalizeStripeWebhookEvent(event, payloadHash);
  if (normalized.status === "unsupported") {
    return response("ignored", 200);
  }
  if (normalized.status === "invalid") {
    return response("invalid_event", 400);
  }

  try {
    const result = await processStripeWebhookEvent(normalized.input);
    return NextResponse.json(
      { received: true, replayed: result.replayed },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof StripeWebhookDatabaseError && !error.retryable) {
      return response("rejected", 400);
    }
    return response("retry", 500);
  }
}

function response(code: string, status: number) {
  return NextResponse.json({ received: false, code }, { status });
}
