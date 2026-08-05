import { describe, expect, test } from "vitest";
import type Stripe from "stripe";

import { normalizeStripeWebhookEvent } from "@/lib/stripe/webhook-processing";

function event(
  type: string,
  object: Record<string, unknown>,
  livemode = false,
) {
  return {
    id: "evt_synthetic",
    type,
    created: 1_700_000_000,
    api_version: "2026-07-29.dahlia",
    livemode,
    data: { object },
  } as unknown as Stripe.Event;
}

describe("Stripe webhook normalization", () => {
  test("normalizes Checkout completion without customer data", () => {
    const result = normalizeStripeWebhookEvent(
      event("checkout.session.completed", {
        id: "cs_test_synthetic",
        payment_intent: "pi_synthetic",
        amount_total: 12500,
        currency: "mxn",
        payment_status: "paid",
        customer_details: { email: "must-not-persist@example.test" },
      }),
      "a".repeat(64),
    );
    expect(result.status).toBe("accepted");
    if (result.status !== "accepted") return;
    expect(result.input.requested_amount).toBe(12500);
    expect(result.input.requested_payment_intent_id).toBe("pi_synthetic");
    expect(JSON.stringify(result.input)).not.toContain("must-not-persist");
  });

  test("requires internal UUID metadata for failed intents", () => {
    expect(
      normalizeStripeWebhookEvent(
        event("payment_intent.payment_failed", {
          id: "pi_synthetic",
          metadata: { checkout_attempt_id: "bad", payment_id: "bad" },
        }),
        "b".repeat(64),
      ).status,
    ).toBe("invalid");
  });

  test("normalizes refunds and ignores unsupported events", () => {
    const refund = normalizeStripeWebhookEvent(
      event("refund.updated", {
        id: "re_synthetic",
        payment_intent: { id: "pi_synthetic" },
        amount: 2500,
        currency: "mxn",
        status: "succeeded",
        failure_reason: null,
        created: 1_700_000_001,
      }),
      "c".repeat(64),
    );
    expect(refund.status).toBe("accepted");
    expect(
      normalizeStripeWebhookEvent(
        event("charge.succeeded", { id: "ch_synthetic" }),
        "d".repeat(64),
      ).status,
    ).toBe("unsupported");
  });
});
