import { z } from "zod";

export const stripeApiVersion = "2026-07-29.dahlia" as const;

export const stripeWebhookEventTypes = [
  "checkout.session.completed",
  "checkout.session.expired",
  "payment_intent.payment_failed",
  "refund.created",
  "refund.updated",
  "refund.failed",
] as const;

export type StripeWebhookEventType = (typeof stripeWebhookEventTypes)[number];

const allowedEvents = new Set<string>(stripeWebhookEventTypes);
const internalMetadataSchema = z.object({
  checkout_attempt_id: z.uuid(),
  payment_id: z.uuid(),
});

export function isAllowedStripeWebhookEvent(
  value: string,
): value is StripeWebhookEventType {
  return allowedEvents.has(value);
}

export function isStripeTestSecretKey(value: string | undefined) {
  return Boolean(value?.startsWith("sk_test_"));
}

export function parseStripeInternalMetadata(value: unknown) {
  return internalMetadataSchema.safeParse(value);
}

export function stripeObjectId(value: unknown, prefix: string) {
  if (typeof value === "string" && value.startsWith(prefix)) return value;
  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof value.id === "string" &&
    value.id.startsWith(prefix)
  ) {
    return value.id;
  }
  return null;
}
