import "server-only";

import { createClient } from "@/lib/supabase/server";
import { normalizeManualOrderAddress } from "@/lib/orders/order-transform";
import type { Database, Json } from "@/types/database.types";
import { z } from "zod";

type OrderStatus = Database["public"]["Enums"]["order_status"];
type PaymentStatus = Database["public"]["Enums"]["manual_payment_status"];

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
  "transfer_pending",
  "transfer_verified",
  "cash_received",
  "external_terminal_received",
]);
const paymentMethodSchema = z.enum([
  "none",
  "bank_transfer",
  "cash",
  "external_terminal",
]);
const customerOrderDetailSchema = z.object({
  id: z.string().uuid(),
  order_number: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  status: orderStatusSchema,
  payment_status: paymentStatusSchema,
  payment_method: paymentMethodSchema,
  subtotal: z.number(),
  shipping_total: z.number(),
  discount_total: z.number(),
  tax_total: z.number(),
  total: z.number(),
  currency: z.string(),
  shipping_address_snapshot: z.custom<Json>(),
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
  paymentMethod: Database["public"]["Enums"]["manual_payment_method"];
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
      paymentStatus: order.payment_status,
      paymentMethod: order.payment_method,
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
