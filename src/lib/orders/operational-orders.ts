import "server-only";

import {
  normalizeManualOrderAddress,
  normalizeManualOrderSummary,
} from "@/lib/orders/order-transform";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type OrderStatus = Database["public"]["Enums"]["order_status"];
type Channel = Database["public"]["Enums"]["manual_order_channel"];
type PaymentStatus = Database["public"]["Enums"]["manual_payment_status"];
type OrderOrigin = Database["public"]["Enums"]["order_origin"];

export type OrderCatalogOption = {
  productId: string;
  variantId: string;
  sku: string;
  name: string;
  variantName: string;
  price: number;
  currency: string;
  available: number | null;
};

export type ManualOrderSummary = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  channel: Channel | null;
  origin: OrderOrigin;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  total: number;
  currency: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ManualOrderAddress = {
  recipientName: string;
  phone: string;
  street: string;
  exteriorNumber: string;
  interiorNumber: string | null;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  references: string | null;
};

export type ManualOrderDetail = ManualOrderSummary & {
  version: number;
  discountTotal: number;
  discountReason: string | null;
  shippingTotal: number;
  subtotal: number;
  internalNote: string | null;
  originChannelDetail: string | null;
  paymentMethod: Database["public"]["Enums"]["manual_payment_method"];
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  address: ManualOrderAddress;
  items: {
    id: string;
    productId: string;
    variantId: string;
    sku: string;
    productName: string;
    variantName: string | null;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }[];
  history: {
    id: string;
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus;
    createdAt: string;
  }[];
};

export type OrderQueryResult<T> =
  { data: T; error: null } | { data: null; error: "unavailable" };

export async function listOrderCatalogOptions(): Promise<
  OrderQueryResult<OrderCatalogOption[]>
> {
  try {
    const client = await createClient();
    const { data, error } = await client
      .from("product_variants")
      .select(
        "id, product_id, sku, name, price, active, archived_at, products!inner(name, price, currency, status, published, archived_at), inventory(quantity_on_hand, quantity_reserved)",
      )
      .eq("active", true)
      .is("archived_at", null)
      .eq("products.status", "active")
      .eq("products.published", true)
      .is("products.archived_at", null)
      .order("sku")
      .limit(500);
    if (error) return { data: null, error: "unavailable" };
    return {
      data: data.map((row) => ({
        productId: row.product_id,
        variantId: row.id,
        sku: row.sku,
        name: row.products.name,
        variantName: row.name,
        price: row.price ?? row.products.price,
        currency: row.products.currency,
        available: row.inventory
          ? row.inventory.quantity_on_hand - row.inventory.quantity_reserved
          : null,
      })),
      error: null,
    };
  } catch {
    return { data: null, error: "unavailable" };
  }
}

export async function listManualOrders(filters: {
  search?: string;
  status?: string;
  channel?: string;
  payment?: string;
  origin?: string;
}): Promise<OrderQueryResult<ManualOrderSummary[]>> {
  try {
    const client = await createClient();
    let query = client
      .from("orders")
      .select(
        "id, order_number, customer_name, customer_email, customer_phone, origin, origin_channel, status, payment_status, total, currency, created_at, updated_at, order_items(quantity)",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    const search = filters.search?.trim().slice(0, 120);
    if (search) {
      const safe = search.replaceAll(/[,%()]/g, " ");
      query = query.or(
        `order_number.ilike.%${safe}%,customer_name.ilike.%${safe}%,customer_email.ilike.%${safe}%,customer_phone.ilike.%${safe}%`,
      );
    }
    if (
      ["pending_confirmation", "preparing", "cancelled"].includes(
        filters.status ?? "",
      )
    ) {
      query = query.eq("status", filters.status as OrderStatus);
    }
    if (
      [
        "whatsapp",
        "instagram",
        "phone",
        "in_person",
        "bank_transfer",
        "other",
      ].includes(filters.channel ?? "")
    ) {
      query = query.eq("origin_channel", filters.channel as Channel);
    }
    if (
      [
        "pending",
        "transfer_pending",
        "transfer_verified",
        "cash_received",
        "external_terminal_received",
      ].includes(filters.payment ?? "")
    ) {
      query = query.eq("payment_status", filters.payment as PaymentStatus);
    }
    if (filters.origin === "manual" || filters.origin === "web") {
      query = query.eq("origin", filters.origin);
    }
    const { data, error } = await query;
    if (error) return { data: null, error: "unavailable" };
    return {
      data: data.flatMap((row) => {
        const normalized = normalizeManualOrderSummary(row);
        return normalized ? [normalized] : [];
      }),
      error: null,
    };
  } catch {
    return { data: null, error: "unavailable" };
  }
}

export async function getManualOrder(
  id: string,
): Promise<OrderQueryResult<ManualOrderDetail | null>> {
  try {
    const client = await createClient();
    const { data, error } = await client
      .from("orders")
      .select(
        "id, order_number, customer_name, customer_email, customer_phone, origin, origin_channel, origin_channel_detail, status, payment_status, payment_method, subtotal, discount_total, discount_reason, shipping_total, total, currency, internal_note, shipping_address_snapshot, confirmed_at, cancelled_at, cancellation_reason, version, created_at, updated_at, order_items(id, product_id, variant_id, sku_snapshot, product_name_snapshot, variant_name_snapshot, unit_price_snapshot, quantity, line_total), order_status_history(id, from_status, to_status, created_at)",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) return { data: null, error: "unavailable" };
    if (!data) return { data: null, error: null };
    if (!data.customer_name || !data.customer_phone)
      return { data: null, error: "unavailable" };
    return {
      data: {
        id: data.id,
        orderNumber: data.order_number,
        customerName: data.customer_name,
        customerEmail: data.customer_email,
        customerPhone: data.customer_phone,
        channel: data.origin_channel,
        origin: data.origin,
        status: data.status,
        paymentStatus: data.payment_status,
        paymentMethod: data.payment_method,
        total: data.total,
        subtotal: data.subtotal,
        discountTotal: data.discount_total,
        discountReason: data.discount_reason,
        shippingTotal: data.shipping_total,
        currency: data.currency,
        itemCount: data.order_items.reduce(
          (sum, item) => sum + item.quantity,
          0,
        ),
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        version: data.version,
        internalNote: data.internal_note,
        originChannelDetail: data.origin_channel_detail,
        confirmedAt: data.confirmed_at,
        cancelledAt: data.cancelled_at,
        cancellationReason: data.cancellation_reason,
        address: normalizeManualOrderAddress(data.shipping_address_snapshot),
        items: data.order_items.map((item) => ({
          id: item.id,
          productId: item.product_id,
          variantId: item.variant_id ?? "",
          sku: item.sku_snapshot,
          productName: item.product_name_snapshot,
          variantName: item.variant_name_snapshot,
          unitPrice: item.unit_price_snapshot,
          quantity: item.quantity,
          lineTotal: item.line_total,
        })),
        history: data.order_status_history
          .map((entry) => ({
            id: entry.id,
            fromStatus: entry.from_status,
            toStatus: entry.to_status,
            createdAt: entry.created_at,
          }))
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      },
      error: null,
    };
  } catch {
    return { data: null, error: "unavailable" };
  }
}
