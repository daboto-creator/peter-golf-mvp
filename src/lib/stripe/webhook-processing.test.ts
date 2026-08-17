import { describe, expect, test } from "vitest";
import type Stripe from "stripe";

import { normalizeStripeWebhookEvent } from "@/lib/stripe/webhook-processing";

function event(
  type: string,
  object: Record<string, unknown>,
  livemode = false,
  apiVersion = "2026-07-29.dahlia",
) {
  return {
    id: "evt_synthetic",
    type,
    created: 1_700_000_000,
    api_version: apiVersion,
    livemode,
    data: { object },
  } as unknown as Stripe.Event;
}

describe("Stripe webhook normalization", () => {
  test("normalizes a realistic 2026-06-24 Checkout completion", () => {
    const result = normalizeStripeWebhookEvent(
      event(
        "checkout.session.completed",
        {
          id: "cs_test_realisticSession123",
          payment_intent: "pi_3RealisticPaymentIntent123",
          amount_total: 114900,
          currency: "mxn",
          payment_status: "paid",
          metadata: {
            payment_id: "22222222-2222-4222-8222-222222222222",
            checkout_attempt_id: "11111111-1111-4111-8111-111111111111",
          },
          customer_details: { email: "must-not-persist@example.test" },
        },
        false,
        "2026-06-24.dahlia",
      ),
      "a".repeat(64),
    );
    expect(result.status).toBe("accepted");
    if (result.status !== "accepted") return;
    expect(result.input).toEqual({
      requested_event_id: "evt_synthetic",
      requested_event_type: "checkout.session.completed",
      requested_event_created_at: "2023-11-14T22:13:20.000Z",
      requested_api_version: "2026-06-24.dahlia",
      requested_livemode: false,
      requested_payload_hash: "a".repeat(64),
      requested_checkout_session_id: "cs_test_realisticSession123",
      requested_checkout_attempt_id: "11111111-1111-4111-8111-111111111111",
      requested_payment_id: "22222222-2222-4222-8222-222222222222",
      requested_payment_intent_id: "pi_3RealisticPaymentIntent123",
      requested_amount: 114900,
      requested_currency: "MXN",
      requested_payment_status: "paid",
      requested_refund_id: null,
      requested_refund_status: null,
      requested_failure_reason: null,
      requested_refund_created_at: null,
    });
    expect(JSON.stringify(result.input)).not.toContain("must-not-persist");
  });

  test("accepts an expanded PaymentIntent on a 2026-07-29 event", () => {
    const expandedEvent = event("checkout.session.completed", {
      id: "cs_test_expandedSession123",
      payment_intent: { id: "pi_3ExpandedPaymentIntent123" },
      amount_total: 114900,
      currency: " mxn ",
      payment_status: "paid",
      metadata: {
        payment_id: "22222222-2222-4222-8222-222222222222",
        checkout_attempt_id: "11111111-1111-4111-8111-111111111111",
      },
    });
    expandedEvent.api_version = "2026-07-29.dahlia";

    const result = normalizeStripeWebhookEvent(expandedEvent, "b".repeat(64));

    expect(result.status).toBe("accepted");
    if (result.status !== "accepted") return;
    expect(result.input.requested_payment_intent_id).toBe(
      "pi_3ExpandedPaymentIntent123",
    );
    expect(result.input.requested_currency).toBe("MXN");
  });

  test("keeps nullable Checkout amounts nullable and rejects wrong metadata names", () => {
    const result = normalizeStripeWebhookEvent(
      event("checkout.session.completed", {
        id: "cs_test_nullableAmount123",
        payment_intent: null,
        amount_total: null,
        currency: null,
        payment_status: "unpaid",
        metadata: {
          paymentId: "22222222-2222-4222-8222-222222222222",
          attempt_id: "11111111-1111-4111-8111-111111111111",
        },
      }),
      "c".repeat(64),
    );

    expect(result.status).toBe("accepted");
    if (result.status !== "accepted") return;
    expect(result.input.requested_amount).toBeNull();
    expect(result.input.requested_currency).toBeNull();
    expect(result.input.requested_payment_id).toBeNull();
    expect(result.input.requested_checkout_attempt_id).toBeNull();
  });

  test("requires internal UUID metadata for failed intents", () => {
    expect(
      normalizeStripeWebhookEvent(
        event("payment_intent.payment_failed", {
          id: "pi_synthetic",
          metadata: { checkout_attempt_id: "bad", payment_id: "bad" },
        }),
        "d".repeat(64),
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
      "e".repeat(64),
    );
    expect(refund.status).toBe("accepted");
    expect(
      normalizeStripeWebhookEvent(
        event("charge.succeeded", { id: "ch_synthetic" }),
        "f".repeat(64),
      ).status,
    ).toBe("unsupported");
  });
});
