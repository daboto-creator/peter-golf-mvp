import type Stripe from "stripe";

import {
  isAllowedStripeWebhookEvent,
  parseStripeInternalMetadata,
  stripeObjectId,
} from "@/lib/stripe/stripe-rules";

export type StripeWebhookRpcInput = {
  requested_event_id: string;
  requested_event_type: string;
  requested_event_created_at: string;
  requested_api_version: string | null;
  requested_livemode: boolean;
  requested_payload_hash: string;
  requested_checkout_session_id: string | null;
  requested_checkout_attempt_id: string | null;
  requested_payment_id: string | null;
  requested_payment_intent_id: string | null;
  requested_amount: number | null;
  requested_currency: string | null;
  requested_payment_status: string | null;
  requested_refund_id: string | null;
  requested_refund_status: string | null;
  requested_failure_reason: string | null;
  requested_refund_created_at: string | null;
};

type Result =
  | { status: "accepted"; input: StripeWebhookRpcInput }
  | { status: "unsupported" }
  | { status: "invalid" };

function isoFromSeconds(value: number) {
  return new Date(value * 1000).toISOString();
}

function normalizedCurrency(value: string | null) {
  const normalized = value?.trim().toUpperCase();
  return normalized || null;
}

function normalizedPaymentStatus(value: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

function base(event: Stripe.Event, payloadHash: string) {
  return {
    requested_event_id: event.id,
    requested_event_type: event.type,
    requested_event_created_at: isoFromSeconds(event.created),
    requested_api_version: event.api_version,
    requested_livemode: event.livemode,
    requested_payload_hash: payloadHash,
    requested_checkout_session_id: null,
    requested_checkout_attempt_id: null,
    requested_payment_id: null,
    requested_payment_intent_id: null,
    requested_amount: null,
    requested_currency: null,
    requested_payment_status: null,
    requested_refund_id: null,
    requested_refund_status: null,
    requested_failure_reason: null,
    requested_refund_created_at: null,
  } satisfies StripeWebhookRpcInput;
}

export function normalizeStripeWebhookEvent(
  event: Stripe.Event,
  payloadHash: string,
): Result {
  if (!isAllowedStripeWebhookEvent(event.type)) {
    return { status: "unsupported" };
  }
  const input = base(event, payloadHash);

  if (event.type.startsWith("checkout.session.")) {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = parseStripeInternalMetadata(session.metadata);
    const paymentIntentId = stripeObjectId(session.payment_intent, "pi_");
    if (!session.id.startsWith("cs_test_")) return { status: "invalid" };
    return {
      status: "accepted",
      input: {
        ...input,
        requested_checkout_session_id: session.id,
        requested_checkout_attempt_id: metadata.success
          ? metadata.data.checkout_attempt_id
          : null,
        requested_payment_id: metadata.success
          ? metadata.data.payment_id
          : null,
        requested_payment_intent_id: paymentIntentId,
        requested_amount: session.amount_total,
        requested_currency: normalizedCurrency(session.currency),
        requested_payment_status: normalizedPaymentStatus(
          session.payment_status,
        ),
      },
    };
  }

  if (event.type === "payment_intent.payment_failed") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const metadata = parseStripeInternalMetadata(paymentIntent.metadata);
    if (!metadata.success || !paymentIntent.id.startsWith("pi_")) {
      return { status: "invalid" };
    }
    return {
      status: "accepted",
      input: {
        ...input,
        requested_checkout_attempt_id: metadata.data.checkout_attempt_id,
        requested_payment_id: metadata.data.payment_id,
        requested_payment_intent_id: paymentIntent.id,
      },
    };
  }

  const refund = event.data.object as Stripe.Refund;
  const paymentIntentId = stripeObjectId(refund.payment_intent, "pi_");
  if (!paymentIntentId || !refund.id.startsWith("re_")) {
    return { status: "invalid" };
  }
  return {
    status: "accepted",
    input: {
      ...input,
      requested_payment_intent_id: paymentIntentId,
      requested_amount: refund.amount,
      requested_currency: normalizedCurrency(refund.currency),
      requested_refund_id: refund.id,
      requested_refund_status: refund.status,
      requested_failure_reason: refund.failure_reason ?? null,
      requested_refund_created_at: isoFromSeconds(refund.created),
    },
  };
}
