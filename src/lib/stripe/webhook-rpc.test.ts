import { describe, expect, test } from "vitest";

import { createStripeWebhookDiagnostic } from "@/lib/stripe/webhook-diagnostics";
import type { StripeWebhookRpcInput } from "@/lib/stripe/webhook-processing";
import {
  isPermanentStripeWebhookDatabaseError,
  toStripeWebhookRpcArgs,
} from "@/lib/stripe/webhook-rpc";

const input: StripeWebhookRpcInput = {
  requested_event_id: "evt_sensitive_full_id",
  requested_event_type: "checkout.session.completed",
  requested_event_created_at: "2026-08-06T12:00:00.000Z",
  requested_api_version: "2026-06-24.dahlia",
  requested_livemode: false,
  requested_payload_hash: "a".repeat(64),
  requested_checkout_session_id: "cs_test_sensitive_full_id",
  requested_checkout_attempt_id: "11111111-1111-4111-8111-111111111111",
  requested_payment_id: "22222222-2222-4222-8222-222222222222",
  requested_payment_intent_id: "pi_sensitive_full_id",
  requested_amount: 114900,
  requested_currency: "MXN",
  requested_payment_status: "paid",
  requested_refund_id: null,
  requested_refund_status: null,
  requested_failure_reason: null,
  requested_refund_created_at: null,
};

describe("Stripe webhook RPC contract", () => {
  test("uses every exact SQL argument name in signature order", () => {
    expect(Object.keys(toStripeWebhookRpcArgs(input))).toEqual([
      "requested_event_id",
      "requested_event_type",
      "requested_event_created_at",
      "requested_api_version",
      "requested_livemode",
      "requested_payload_hash",
      "requested_checkout_session_id",
      "requested_checkout_attempt_id",
      "requested_payment_id",
      "requested_payment_intent_id",
      "requested_amount",
      "requested_currency",
      "requested_payment_status",
      "requested_refund_id",
      "requested_refund_status",
      "requested_failure_reason",
      "requested_refund_created_at",
    ]);
    expect(toStripeWebhookRpcArgs(input)).toEqual(input);
  });

  test("diagnostics retain presence only and discard IDs, PII and unsafe fields", () => {
    const diagnostic = createStripeWebhookDiagnostic(
      "rpc",
      "bad category customer@example.test pi_sensitive_full_id",
      input,
      {
        code: "22023",
        hintCode: "secret customer@example.test",
      },
    );

    expect(diagnostic).toEqual({
      stage: "rpc",
      eventType: "checkout.session.completed",
      category: "unknown",
      postgresCode: "22023",
      hasCheckoutSessionId: true,
      hasPaymentIntentId: true,
      hasPaymentId: true,
      hasAttemptId: true,
      paymentStatus: "paid",
      amountPresent: true,
      currencyPresent: true,
    });
    expect(JSON.stringify(diagnostic)).not.toMatch(
      /sensitive|11111111|22222222|customer@|payload|metadata|stack|header/i,
    );
  });

  test("allows only a sanitized Postgres hint code", () => {
    expect(
      createStripeWebhookDiagnostic("rpc", "transient_database", input, {
        code: "P0002",
        hintCode: "stripe_checkout_session_missing",
      }),
    ).toMatchObject({
      postgresCode: "P0002",
      postgresHintCode: "stripe_checkout_session_missing",
    });
  });

  test("retries transient database failures and rejects known incoherence", () => {
    expect(
      isPermanentStripeWebhookDatabaseError(
        "23505",
        "stripe_event_id_conflict",
      ),
    ).toBe(true);
    expect(isPermanentStripeWebhookDatabaseError("22023")).toBe(false);
    expect(isPermanentStripeWebhookDatabaseError("23514")).toBe(false);
    expect(isPermanentStripeWebhookDatabaseError("23505")).toBe(false);
    expect(isPermanentStripeWebhookDatabaseError("P0002")).toBe(false);
    expect(isPermanentStripeWebhookDatabaseError("40001")).toBe(false);
    expect(isPermanentStripeWebhookDatabaseError("40P01")).toBe(false);
    expect(isPermanentStripeWebhookDatabaseError("PGRST202")).toBe(false);
    expect(isPermanentStripeWebhookDatabaseError()).toBe(false);
  });
});
