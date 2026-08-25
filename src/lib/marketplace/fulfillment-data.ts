import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function listPartnerSales() {
  const client = await createClient();
  const { data, error } = await client.rpc("get_partner_marketplace_sales");
  return { data: data ?? [], error };
}

export async function getPartnerSale(fulfillmentId: string) {
  const client = await createClient();
  const { data, error } = await client.rpc("get_partner_marketplace_sales", {
    requested_fulfillment_id: fulfillmentId,
  });
  return { data: data ?? [], error };
}

export async function listMarketplaceOrdersForOperations() {
  const client = await createClient();
  const fulfillments = await client
    .from("order_fulfillments")
    .select(
      "id, order_id, source, partner_id, fulfillment_mode, custody, status, version, activated_at, inventory_confirmation_due_at, carrier_handoff_due_at, hold_reason, cancellation_reason, created_at, orders(order_number, status, marketplace_exception_status, total, currency, order_payments(status, provider))",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  return { data: fulfillments.data ?? [], error: fulfillments.error };
}

export async function getMarketplaceOrderForOperations(orderId: string) {
  const client = await createClient();
  const [order, fulfillments, reservations, snapshots] = await Promise.all([
    client
      .from("orders")
      .select(
        "id, order_number, status, marketplace_exception_status, subtotal, shipping_total, total, currency, created_at",
      )
      .eq("id", orderId)
      .maybeSingle(),
    client.from("order_fulfillments").select("*").eq("order_id", orderId),
    client.from("inventory_reservations").select("*").eq("order_id", orderId),
    client
      .from("marketplace_order_item_snapshots")
      .select("*")
      .in(
        "fulfillment_id",
        (
          await client
            .from("order_fulfillments")
            .select("id")
            .eq("order_id", orderId)
        ).data?.map((item) => item.id) ?? [],
      ),
  ]);
  return {
    order: order.data,
    fulfillments: fulfillments.data ?? [],
    reservations: reservations.data ?? [],
    snapshots: snapshots.data ?? [],
    error:
      order.error ??
      fulfillments.error ??
      reservations.error ??
      snapshots.error,
  };
}
