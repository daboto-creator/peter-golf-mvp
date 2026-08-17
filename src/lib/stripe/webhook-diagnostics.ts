import type { StripeWebhookRpcInput } from "@/lib/stripe/webhook-processing";

export type StripeWebhookDiagnosticStage = "signature" | "normalize" | "rpc";

type StripeWebhookDiagnostic = {
  stage: StripeWebhookDiagnosticStage;
  eventType: string;
  category: string;
  postgresCode?: string;
  postgresHintCode?: string;
  hasCheckoutSessionId: boolean;
  hasPaymentIntentId: boolean;
  hasPaymentId: boolean;
  hasAttemptId: boolean;
  paymentStatus: "paid" | "unpaid" | "no_payment_required" | "other" | null;
  amountPresent: boolean;
  currencyPresent: boolean;
};

const safeEventTypes = new Set([
  "checkout.session.completed",
  "checkout.session.expired",
  "payment_intent.payment_failed",
  "refund.created",
  "refund.updated",
  "refund.failed",
]);

function safeEventType(value: unknown) {
  return typeof value === "string" && safeEventTypes.has(value)
    ? value
    : "unknown";
}

function safePaymentStatus(value: string | null | undefined) {
  if (
    value === "paid" ||
    value === "unpaid" ||
    value === "no_payment_required"
  ) {
    return value;
  }
  return value ? ("other" as const) : null;
}

function safePostgresCode(value: unknown) {
  return typeof value === "string" && /^[A-Z0-9]{5}$/.test(value)
    ? value
    : undefined;
}

function safePostgresHintCode(value: unknown) {
  return typeof value === "string" && /^stripe_[a-z0-9_]{1,64}$/.test(value)
    ? value
    : undefined;
}

export function createStripeWebhookDiagnostic(
  stage: StripeWebhookDiagnosticStage,
  category: string,
  input?: StripeWebhookRpcInput,
  databaseError?: { code?: unknown; hintCode?: unknown },
): StripeWebhookDiagnostic {
  const postgresCode = safePostgresCode(databaseError?.code);
  const postgresHintCode = safePostgresHintCode(databaseError?.hintCode);
  const safeCategory = /^[a-z][a-z0-9_]{0,79}$/.test(category)
    ? category
    : "unknown";

  return {
    stage,
    eventType: safeEventType(input?.requested_event_type),
    category: safeCategory,
    ...(postgresCode ? { postgresCode } : {}),
    ...(postgresHintCode ? { postgresHintCode } : {}),
    hasCheckoutSessionId: Boolean(input?.requested_checkout_session_id),
    hasPaymentIntentId: Boolean(input?.requested_payment_intent_id),
    hasPaymentId: Boolean(input?.requested_payment_id),
    hasAttemptId: Boolean(input?.requested_checkout_attempt_id),
    paymentStatus: safePaymentStatus(input?.requested_payment_status),
    amountPresent: input?.requested_amount != null,
    currencyPresent: Boolean(input?.requested_currency),
  };
}
