import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type PayableStatus =
  Database["public"]["Enums"]["marketplace_partner_payable_status"];

export async function getPartnerFinanceOverview() {
  const client = await createClient();
  const [balance, payables] = await Promise.all([
    client.rpc("get_partner_marketplace_balance"),
    client.rpc("get_partner_marketplace_payables"),
  ]);
  return {
    balance: balance.data?.[0] ?? null,
    payables: payables.data ?? [],
    error: balance.error ?? payables.error,
  };
}

export async function getPartnerPayable(payableId: string) {
  const client = await createClient();
  const [payable, holds, ledger, history] = await Promise.all([
    client.rpc("get_partner_marketplace_payables", {
      requested_payable_id: payableId,
    }),
    client.rpc("get_partner_marketplace_payable_holds", {
      requested_payable_id: payableId,
    }),
    client
      .from("marketplace_partner_ledger_entries")
      .select(
        "id, entry_type, amount_cents, pending_delta_cents, on_hold_delta_cents, available_delta_cents, paid_delta_cents, reversed_delta_cents, reason, created_at",
      )
      .eq("payable_id", payableId)
      .order("created_at", { ascending: false }),
    client
      .from("marketplace_partner_payable_status_history")
      .select("id, from_status, to_status, reason, created_at")
      .eq("payable_id", payableId)
      .order("created_at", { ascending: false }),
  ]);
  return {
    payable: payable.data?.[0] ?? null,
    holds: holds.data ?? [],
    ledger: ledger.data ?? [],
    history: history.data ?? [],
    error: payable.error ?? holds.error ?? ledger.error ?? history.error,
  };
}

export async function listMarketplacePayablesForOperations(filters?: {
  status?: string;
  partnerId?: string;
  orderId?: string;
  hasHold?: boolean;
}) {
  const client = await createClient();
  let query = client
    .from("marketplace_partner_payables")
    .select(
      "id, partner_id, order_id, order_item_id, fulfillment_id, original_amount_cents, reversed_amount_cents, status, currency, created_at, orders(order_number), marketplace_order_item_snapshots(listing_title)",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (filters?.status)
    query = query.eq("status", filters.status as PayableStatus);
  if (filters?.partnerId) query = query.eq("partner_id", filters.partnerId);
  if (filters?.orderId) query = query.eq("order_id", filters.orderId);
  if (filters?.hasHold) {
    const { data: activeHolds, error } = await client
      .from("marketplace_partner_holds")
      .select("payable_id")
      .eq("status", "ACTIVE");
    if (error) return { data: [], error };
    const ids = [
      ...new Set((activeHolds ?? []).map((hold) => hold.payable_id)),
    ];
    if (!ids.length) return { data: [], error: null };
    query = query.in("id", ids);
  }
  const result = await query;
  return { data: result.data ?? [], error: result.error };
}

export async function getMarketplacePayableForOperations(payableId: string) {
  const client = await createClient();
  const [payable, holds, ledger, history, releaseAuthorizations] =
    await Promise.all([
      client
        .from("marketplace_partner_payables")
        .select("*")
        .eq("id", payableId)
        .maybeSingle(),
      client
        .from("marketplace_partner_holds")
        .select("*")
        .eq("payable_id", payableId)
        .order("created_at", { ascending: false }),
      client
        .from("marketplace_partner_ledger_entries")
        .select("*")
        .eq("payable_id", payableId)
        .order("created_at", { ascending: false }),
      client
        .from("marketplace_partner_payable_status_history")
        .select("*")
        .eq("payable_id", payableId)
        .order("created_at", { ascending: false }),
      client
        .from("marketplace_partner_release_authorizations")
        .select("*")
        .eq("payable_id", payableId)
        .order("created_at", { ascending: false }),
    ]);
  const snapshot = payable.data
    ? await client
        .from("marketplace_order_item_snapshots")
        .select("*")
        .eq("order_item_id", payable.data.order_item_id)
        .maybeSingle()
    : { data: null, error: null };
  const fulfillment = payable.data
    ? await client
        .from("order_fulfillments")
        .select("id, status, source, fulfillment_mode, custody")
        .eq("id", payable.data.fulfillment_id)
        .maybeSingle()
    : { data: null, error: null };
  const order = payable.data
    ? await client
        .from("orders")
        .select("id, order_number, status, payment_status, currency")
        .eq("id", payable.data.order_id)
        .maybeSingle()
    : { data: null, error: null };
  return {
    payable: payable.data,
    holds: holds.data ?? [],
    ledger: ledger.data ?? [],
    history: history.data ?? [],
    releaseAuthorizations: releaseAuthorizations.data ?? [],
    snapshot: snapshot.data,
    fulfillment: fulfillment.data,
    order: order.data,
    error:
      payable.error ??
      holds.error ??
      ledger.error ??
      history.error ??
      releaseAuthorizations.error ??
      snapshot.error ??
      fulfillment.error ??
      order.error,
  };
}
