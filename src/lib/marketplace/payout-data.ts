import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getPartnerPayouts() {
  const client = await createClient();
  const [payouts, items] = await Promise.all([
    client.rpc("get_partner_marketplace_payouts"),
    client
      .from("marketplace_partner_payout_items")
      .select(
        "id, payout_id, payable_id, settlement_amount_cents, currency, settled_at, marketplace_partner_payables(order_id, marketplace_order_item_snapshots(listing_title), orders(order_number))",
      )
      .is("released_at", null)
      .order("created_at", { ascending: false }),
  ]);
  return {
    payouts: payouts.data ?? [],
    items: items.data ?? [],
    error: payouts.error ?? items.error,
  };
}

export async function listPayoutsForOperations(filters?: {
  status?: string;
  partnerId?: string;
}) {
  const client = await createClient();
  let query = client
    .from("marketplace_partner_payouts")
    .select(
      "id, payout_reference, partner_id, provider, status, total_cents, item_count, currency, created_at, ready_at, paid_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (filters?.status) query = query.eq("status", filters.status as never);
  if (filters?.partnerId) query = query.eq("partner_id", filters.partnerId);
  const result = await query;
  const [available, prepared, paid, holds, reconciliation] = await Promise.all([
    client
      .from("marketplace_partner_payables")
      .select("original_amount_cents,reversed_amount_cents,paid_amount_cents")
      .eq("status", "AVAILABLE"),
    client
      .from("marketplace_partner_payouts")
      .select("total_cents")
      .in("status", ["DRAFT", "READY", "AWAITING_CONFIRMATION"]),
    client
      .from("marketplace_partner_payouts")
      .select("total_cents")
      .eq("status", "PAID"),
    client
      .from("marketplace_partner_payouts")
      .select("total_cents")
      .eq("status", "ON_HOLD"),
    client
      .from("marketplace_partner_payouts")
      .select("total_cents")
      .eq("status", "RECONCILIATION_REQUIRED"),
  ]);
  const sum = (rows: { total_cents: number }[] | null) =>
    (rows ?? []).reduce((total, row) => total + Number(row.total_cents), 0);
  return {
    data: result.data ?? [],
    summary: {
      availableCents: (available.data ?? []).reduce(
        (total, row) =>
          total +
          Number(row.original_amount_cents) -
          Number(row.reversed_amount_cents) -
          Number(row.paid_amount_cents),
        0,
      ),
      preparedCents: sum(prepared.data),
      paidCents: sum(paid.data),
      onHoldCents: sum(holds.data),
      reconciliationCents: sum(reconciliation.data),
    },
    error:
      result.error ??
      available.error ??
      prepared.error ??
      paid.error ??
      holds.error ??
      reconciliation.error,
  };
}

export async function getPayoutForOperations(payoutId: string) {
  const client = await createClient();
  const [payout, items, holds, settlement, events, candidates] =
    await Promise.all([
      client
        .from("marketplace_partner_payouts")
        .select("*")
        .eq("id", payoutId)
        .maybeSingle(),
      client
        .from("marketplace_partner_payout_items")
        .select(
          "*, marketplace_partner_payables(status,original_amount_cents,reversed_amount_cents,paid_amount_cents,order_id,marketplace_order_item_snapshots(listing_title),orders(order_number))",
        )
        .eq("payout_id", payoutId)
        .is("released_at", null)
        .order("created_at"),
      client
        .from("marketplace_partner_payout_holds")
        .select("*")
        .eq("payout_id", payoutId)
        .order("created_at", { ascending: false }),
      client
        .from("marketplace_partner_settlements")
        .select("*")
        .eq("payout_id", payoutId)
        .maybeSingle(),
      client
        .from("marketplace_partner_payout_events")
        .select("*")
        .eq("payout_id", payoutId)
        .order("created_at", { ascending: false }),
      client
        .from("marketplace_partner_payables")
        .select(
          "id,partner_id,status,original_amount_cents,reversed_amount_cents,paid_amount_cents,marketplace_order_item_snapshots(listing_title),orders(order_number)",
        )
        .eq("status", "AVAILABLE")
        .limit(100),
    ]);
  return {
    payout: payout.data,
    items: items.data ?? [],
    holds: holds.data ?? [],
    settlement: settlement.data,
    events: events.data ?? [],
    candidates: (candidates.data ?? []).filter(
      (candidate) => candidate.partner_id === payout.data?.partner_id,
    ),
    error:
      payout.error ??
      items.error ??
      holds.error ??
      settlement.error ??
      events.error ??
      candidates.error,
  };
}
