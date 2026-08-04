export const notificationEventTypes = [
  "order_created",
  "order_confirmed",
  "transfer_submitted",
  "payment_under_review",
  "payment_paid",
  "payment_rejected",
  "payment_refunded",
  "order_cancelled",
] as const;

export type NotificationEventType = (typeof notificationEventTypes)[number];

export const notificationEventLabels: Record<NotificationEventType, string> = {
  order_created: "Pedido creado",
  order_confirmed: "Pedido confirmado y en preparación",
  transfer_submitted: "Transferencia registrada",
  payment_under_review: "Pago en revisión",
  payment_paid: "Pago aprobado",
  payment_rejected: "Pago rechazado",
  payment_refunded: "Pago reembolsado",
  order_cancelled: "Pedido cancelado",
};

export function isRecipientAllowed(
  email: string,
  allowedDomains: readonly string[],
) {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) return false;
  return allowedDomains.includes(normalized.slice(at + 1));
}

export function deterministicMessageId(deliveryId: string) {
  return `<notification-${deliveryId}@peter-golf.test>`;
}

const permanentErrorCodes = new Set([
  "invalid_recipient",
  "recipient_domain_not_allowed",
  "notifications_disabled",
  "transport_disabled",
  "template_invalid",
  "smtp_permanent",
]);

export function isPermanentNotificationError(code: string) {
  return permanentErrorCodes.has(code);
}

export function retryDelayMs(attemptCount: number) {
  return [60_000, 300_000, 900_000, 3_600_000][attemptCount - 1] ?? null;
}

export function sanitizeNotificationError(error: unknown) {
  if (!error || typeof error !== "object") return "smtp_unknown";
  const value = error as { code?: unknown; responseCode?: unknown };
  if (typeof value.responseCode === "number") {
    if (value.responseCode >= 500) return "smtp_permanent";
    if (value.responseCode >= 400) return "smtp_temporary";
  }
  const code = typeof value.code === "string" ? value.code.toUpperCase() : "";
  if (["EENVELOPE", "EMESSAGE"].includes(code)) return "invalid_recipient";
  if (["ECONNECTION", "ETIMEDOUT", "ECONNREFUSED", "ESOCKET"].includes(code))
    return "smtp_unavailable";
  return "smtp_unknown";
}
