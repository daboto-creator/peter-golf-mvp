import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  normalizeManualOrderAddress,
  resolveEffectiveStripeCheckoutStatus,
} from "@/lib/orders/order-transform";
import type { Database, Json } from "@/types/database.types";
import { z } from "zod";

type OrderStatus = Database["public"]["Enums"]["order_status"];
type PaymentStatus = Database["public"]["Enums"]["payment_status"];

const orderStatusSchema = z.enum([
  "created",
  "pending_confirmation",
  "simulated_payment_approved",
  "preparing",
  "ready_to_ship",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
]);
const paymentStatusSchema = z.enum([
  "pending",
  "submitted",
  "under_review",
  "paid",
  "rejected",
  "failed",
  "refunded",
  "partially_refunded",
]);
const paymentMethodSchema = z.enum([
  "bank_transfer",
  "cash",
  "external_terminal",
  "card",
]);
const paymentProviderSchema = z.enum(["manual", "stripe"]);
const stripeCheckoutStatusSchema = z
  .enum([
    "creating",
    "open",
    "payment_failed",
    "completed",
    "expired",
    "abandoned",
  ])
  .nullable();
const customerOrderDetailSchema = z.object({
  id: z.string().uuid(),
  order_number: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  status: orderStatusSchema,
  subtotal: z.number(),
  shipping_total: z.number(),
  discount_total: z.number(),
  tax_total: z.number(),
  total: z.number(),
  currency: z.string(),
  shipping_address_snapshot: z.custom<Json>(),
  payment: z.object({
    id: z.string().uuid(),
    provider: paymentProviderSchema,
    status: paymentStatusSchema,
    method: paymentMethodSchema,
    expected_amount: z.number(),
    refunded_amount: z.number(),
    currency: z.string(),
    version: z.number().int().positive(),
    submitted_at: z.string().nullable(),
    under_review_at: z.string().nullable(),
    paid_at: z.string().nullable(),
    rejected_at: z.string().nullable(),
    refunded_at: z.string().nullable(),
    stripe_status: stripeCheckoutStatusSchema,
    stripe_expires_at: z.string().nullable(),
    submissions: z.array(
      z.object({
        attempt_number: z.number().int().positive(),
        transfer_reference: z.string(),
        transferred_at: z.string(),
        sender_name: z.string().nullable(),
        sender_bank: z.string().nullable(),
        created_at: z.string(),
      }),
    ),
    history: z.array(
      z.object({
        from_status: paymentStatusSchema.nullable(),
        to_status: paymentStatusSchema,
        created_at: z.string(),
      }),
    ),
  }),
  order_items: z.array(
    z.object({
      sku_snapshot: z.string(),
      product_name_snapshot: z.string(),
      variant_name_snapshot: z.string().nullable(),
      unit_price_snapshot: z.number(),
      quantity: z.number().int().positive(),
      line_total: z.number(),
    }),
  ),
  history: z.array(
    z.object({
      from_status: orderStatusSchema.nullable(),
      to_status: orderStatusSchema,
      created_at: z.string(),
    }),
  ),
});

export type CustomerOrderSummary = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  total: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

export type CustomerOrderDetail = CustomerOrderSummary & {
  subtotal: number;
  shippingTotal: number;
  discountTotal: number;
  taxTotal: number;
  paymentId: string;
  paymentProvider: Database["public"]["Enums"]["payment_provider"];
  paymentMethod: Database["public"]["Enums"]["payment_method"];
  paymentVersion: number;
  paymentExpectedAmount: number;
  paymentRefundedAmount: number;
  paymentCurrency: string;
  paymentSubmittedAt: string | null;
  paymentUnderReviewAt: string | null;
  paymentPaidAt: string | null;
  paymentRejectedAt: string | null;
  paymentRefundedAt: string | null;
  stripeCheckoutStatus:
    Database["public"]["Enums"]["stripe_checkout_status"] | null;
  stripeCheckoutExpiresAt: string | null;
  paymentSubmissions: {
    attemptNumber: number;
    transferReference: string;
    transferredAt: string;
    senderName: string | null;
    senderBank: string | null;
    createdAt: string;
  }[];
  paymentHistory: {
    fromStatus: PaymentStatus | null;
    toStatus: PaymentStatus;
    createdAt: string;
  }[];
  address: ReturnType<typeof normalizeManualOrderAddress>;
  items: {
    sku: string;
    productName: string;
    variantName: string | null;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }[];
  history: {
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus;
    createdAt: string;
  }[];
};

export async function listCustomerOrders(): Promise<
  CustomerOrderSummary[] | null
> {
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("list_customer_orders");
    if (error) return null;
    return data.map((order) => ({
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      paymentStatus: order.payment_status,
      total: order.total,
      currency: order.currency,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    }));
  } catch {
    return null;
  }
}

export async function getCustomerOrder(
  id: string,
): Promise<CustomerOrderDetail | null> {
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("get_customer_order", {
      requested_order_id: id,
    });
    const parsed = customerOrderDetailSchema.safeParse(data);
    if (error || !parsed.success) return null;
    const order = parsed.data;
    return {
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      paymentStatus: order.payment.status,
      paymentId: order.payment.id,
      paymentProvider: order.payment.provider,
      paymentMethod: order.payment.method,
      paymentVersion: order.payment.version,
      paymentExpectedAmount: order.payment.expected_amount,
      paymentRefundedAmount: order.payment.refunded_amount,
      paymentCurrency: order.payment.currency,
      paymentSubmittedAt: order.payment.submitted_at,
      paymentUnderReviewAt: order.payment.under_review_at,
      paymentPaidAt: order.payment.paid_at,
      paymentRejectedAt: order.payment.rejected_at,
      paymentRefundedAt: order.payment.refunded_at,
      stripeCheckoutStatus: resolveEffectiveStripeCheckoutStatus(
        order.payment.stripe_status,
        order.payment.stripe_expires_at,
      ),
      stripeCheckoutExpiresAt: order.payment.stripe_expires_at,
      paymentSubmissions: order.payment.submissions.map((submission) => ({
        attemptNumber: submission.attempt_number,
        transferReference: submission.transfer_reference,
        transferredAt: submission.transferred_at,
        senderName: submission.sender_name,
        senderBank: submission.sender_bank,
        createdAt: submission.created_at,
      })),
      paymentHistory: order.payment.history.map((entry) => ({
        fromStatus: entry.from_status,
        toStatus: entry.to_status,
        createdAt: entry.created_at,
      })),
      subtotal: order.subtotal,
      discountTotal: order.discount_total,
      shippingTotal: order.shipping_total,
      taxTotal: order.tax_total,
      total: order.total,
      currency: order.currency,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      address: normalizeManualOrderAddress(order.shipping_address_snapshot),
      items: order.order_items.map((item) => ({
        sku: item.sku_snapshot,
        productName: item.product_name_snapshot,
        variantName: item.variant_name_snapshot,
        unitPrice: item.unit_price_snapshot,
        quantity: item.quantity,
        lineTotal: item.line_total,
      })),
      history: order.history
        .map((entry) => ({
          fromStatus: entry.from_status,
          toStatus: entry.to_status,
          createdAt: entry.created_at,
        }))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    };
  } catch {
    return null;
  }
}
