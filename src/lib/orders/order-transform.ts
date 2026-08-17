import type {
  ManualOrderAddress,
  ManualOrderSummary,
} from "@/lib/orders/operational-orders";
import type { Database, Json } from "@/types/database.types";

type StripeCheckoutStatus =
  Database["public"]["Enums"]["stripe_checkout_status"];

export function resolveEffectiveStripeCheckoutStatus(
  status: StripeCheckoutStatus | null,
  expiresAt: string | null,
  nowMs = Date.now(),
): StripeCheckoutStatus | null {
  if (!status || !expiresAt) return status;
  const expirationMs = Date.parse(expiresAt);
  if (!Number.isFinite(expirationMs) || expirationMs > nowMs) return status;
  if (status === "creating") return "abandoned";
  if (status === "open") return "expired";
  return status;
}

export function canStartStripeCheckout({
  paymentsMode,
  stripeMode,
  orderStatus,
  paymentStatus,
  stripeStatus,
  stripeExpiresAt,
  nowMs = Date.now(),
}: {
  paymentsMode: "disabled" | "test";
  stripeMode: "disabled" | "test";
  orderStatus: Database["public"]["Enums"]["order_status"];
  paymentStatus: Database["public"]["Enums"]["payment_status"];
  stripeStatus: StripeCheckoutStatus | null;
  stripeExpiresAt: string | null;
  nowMs?: number;
}) {
  const effectiveStatus = resolveEffectiveStripeCheckoutStatus(
    stripeStatus,
    stripeExpiresAt,
    nowMs,
  );
  return (
    paymentsMode === "test" &&
    stripeMode === "test" &&
    orderStatus === "pending_confirmation" &&
    (paymentStatus === "pending" || paymentStatus === "failed") &&
    effectiveStatus !== "creating" &&
    effectiveStatus !== "open"
  );
}

export type ManualOrderListRecord = {
  id: string;
  order_number: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  origin_channel: Database["public"]["Enums"]["manual_order_channel"] | null;
  origin: Database["public"]["Enums"]["order_origin"];
  status: Database["public"]["Enums"]["order_status"];
  order_payments: {
    status: Database["public"]["Enums"]["payment_status"];
    provider: Database["public"]["Enums"]["payment_provider"];
  } | null;
  total: number;
  currency: string;
  created_at: string;
  updated_at: string;
  order_items: { quantity: number }[];
};

export function normalizeManualOrderSummary(
  row: ManualOrderListRecord,
): ManualOrderSummary | null {
  if (!row.customer_name || !row.customer_phone) {
    return null;
  }
  return {
    id: row.id,
    orderNumber: row.order_number,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    channel: row.origin_channel,
    origin: row.origin,
    status: row.status,
    paymentStatus: row.order_payments?.status ?? null,
    paymentProvider: row.order_payments?.provider ?? null,
    total: row.total,
    currency: row.currency,
    itemCount: row.order_items.reduce((sum, item) => sum + item.quantity, 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeManualOrderAddress(value: Json): ManualOrderAddress {
  const address =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? value
      : {};
  const text = (field: Json | undefined) =>
    typeof field === "string" ? field : "";
  const nullable = (field: Json | undefined) =>
    typeof field === "string" && field ? field : null;
  return {
    recipientName: text(address.recipient_name),
    phone: text(address.phone),
    street: text(address.street),
    exteriorNumber: text(address.exterior_number),
    interiorNumber: nullable(address.interior_number),
    neighborhood: text(address.neighborhood),
    city: text(address.city),
    state: text(address.state),
    postalCode: text(address.postal_code),
    references: nullable(address.references),
  };
}
