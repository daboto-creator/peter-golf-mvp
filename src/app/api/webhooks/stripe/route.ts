import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { serverEnv } from "@/env/server";
import { getStripeClient } from "@/lib/stripe/server";
import { createStripeWebhookDiagnostic } from "@/lib/stripe/webhook-diagnostics";
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
  if (!signature) {
    logDiagnostic(
      createStripeWebhookDiagnostic("signature", "missing_signature"),
    );
    return response("invalid_signature", 400);
  }

  const rawBody = await request.text();
  let event;
  try {
    event = getStripeClient().webhooks.constructEvent(
      rawBody,
      signature,
      serverEnv.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    logDiagnostic(
      createStripeWebhookDiagnostic("signature", "invalid_signature"),
    );
    return response("invalid_signature", 400);
  }

  const payloadHash = createHash("sha256").update(rawBody).digest("hex");
  const normalized = normalizeStripeWebhookEvent(event, payloadHash);
  if (normalized.status === "unsupported") {
    return response("ignored", 200);
  }
  if (normalized.status === "invalid") {
    logDiagnostic(createStripeWebhookDiagnostic("normalize", "invalid_event"));
    return response("invalid_event", 200);
  }

  if (event.livemode) {
    logDiagnostic(
      createStripeWebhookDiagnostic(
        "normalize",
        "live_mode_forbidden",
        normalized.input,
      ),
    );
    return response("live_mode_forbidden", 200);
  }

  try {
    const result = await processStripeWebhookEvent(normalized.input);
    if (!result.processed) {
      const retryable = result.outcome === "processing";
      logDiagnostic(
        createStripeWebhookDiagnostic(
          "rpc",
          retryable
            ? "transient_processing"
            : result.outcome || "permanent_rejection",
          normalized.input,
        ),
      );
      return response(retryable ? "retry" : "rejected", retryable ? 500 : 200);
    }
    return NextResponse.json(
      { received: true, replayed: result.replayed },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof StripeWebhookDatabaseError) {
      logDiagnostic(
        createStripeWebhookDiagnostic(
          "rpc",
          error.retryable ? "transient_database" : "permanent_database",
          normalized.input,
          error,
        ),
      );
    } else {
      logDiagnostic(
        createStripeWebhookDiagnostic(
          "rpc",
          "unexpected_database",
          normalized.input,
        ),
      );
    }
    if (error instanceof StripeWebhookDatabaseError && !error.retryable) {
      return response("rejected", 200);
    }
    return response("retry", 500);
  }
}

function logDiagnostic(
  diagnostic: ReturnType<typeof createStripeWebhookDiagnostic>,
) {
  console.error("stripe_webhook", diagnostic);
}

function response(code: string, status: number) {
  return NextResponse.json({ received: false, code }, { status });
}
