import type { StripeWebhookRpcInput } from "@/lib/stripe/webhook-processing";
import type { Database } from "@/types/database.types";

export type StripeWebhookRpcArgs =
  Database["public"]["Functions"]["process_stripe_webhook_event"]["Args"];

export function isPermanentStripeWebhookDatabaseError(
  code?: string,
  hintCode?: string,
) {
  return code === "23505" && hintCode === "stripe_event_id_conflict";
}

export function toStripeWebhookRpcArgs(
  input: StripeWebhookRpcInput,
): StripeWebhookRpcArgs {
  return {
    requested_event_id: input.requested_event_id,
    requested_event_type: input.requested_event_type,
    requested_event_created_at: input.requested_event_created_at,
    requested_api_version: input.requested_api_version,
    requested_livemode: input.requested_livemode,
    requested_payload_hash: input.requested_payload_hash,
    requested_checkout_session_id: input.requested_checkout_session_id,
    requested_checkout_attempt_id: input.requested_checkout_attempt_id,
    requested_payment_id: input.requested_payment_id,
    requested_payment_intent_id: input.requested_payment_intent_id,
    requested_amount: input.requested_amount,
    requested_currency: input.requested_currency,
    requested_payment_status: input.requested_payment_status,
    requested_refund_id: input.requested_refund_id,
    requested_refund_status: input.requested_refund_status,
    requested_failure_reason: input.requested_failure_reason,
    requested_refund_created_at: input.requested_refund_created_at,
  } as StripeWebhookRpcArgs;
}
