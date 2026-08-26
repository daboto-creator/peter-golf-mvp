import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getCustomerClaimContext(orderId: string) {
  const client = await createClient();
  const { data, error } = await client.rpc(
    "get_customer_marketplace_claim_context",
    { requested_order_id: orderId },
  );
  return { data: data ?? [], error };
}

export async function getPartnerClaims(claimId?: string) {
  const client = await createClient();
  const { data, error } = await client.rpc("get_partner_marketplace_claims", {
    requested_claim_id: claimId ?? undefined,
  });
  return { data: data ?? [], error };
}

export async function getOperationsClaims(claimId?: string) {
  const client = await createClient();
  const { data, error } = await client.rpc(
    "get_marketplace_claims_for_operations",
    { requested_claim_id: claimId ?? undefined },
  );
  return { data: data ?? [], error };
}

export async function getOperationsClaimDetail(claimId: string) {
  const client = await createClient();
  const { data: claims } = await client.rpc(
    "get_marketplace_claims_for_operations",
    { requested_claim_id: claimId },
  );
  const claim = claims?.[0];
  const [events, evidence, resolution, payable, snapshot, marketplaceReturn] =
    await Promise.all([
      client
        .from("marketplace_claim_events")
        .select("*")
        .eq("claim_id", claimId)
        .order("created_at"),
      client
        .from("marketplace_claim_evidence")
        .select("*")
        .eq("claim_id", claimId)
        .order("created_at"),
      client
        .from("marketplace_claim_resolutions")
        .select("*")
        .eq("claim_id", claimId)
        .maybeSingle(),
      client
        .from("marketplace_partner_payables")
        .select("*")
        .eq("id", claim?.payable_id ?? "00000000-0000-0000-0000-000000000000")
        .maybeSingle(),
      client
        .from("marketplace_order_item_snapshots")
        .select("*")
        .eq(
          "order_item_id",
          claim?.order_item_id ?? "00000000-0000-0000-0000-000000000000",
        )
        .maybeSingle(),
      client
        .from("marketplace_returns")
        .select("*")
        .eq("claim_id", claimId)
        .maybeSingle(),
    ]);
  const evidenceWithUrls = await Promise.all(
    (evidence.data ?? []).map(async (item) => {
      const signed = await client.storage
        .from("marketplace-claim-evidence")
        .createSignedUrl(item.storage_path, 300);
      return { ...item, signedUrl: signed.data?.signedUrl ?? null };
    }),
  );
  return {
    claim: claim ?? null,
    events: events.data ?? [],
    evidence: evidenceWithUrls,
    resolution: resolution.data,
    payable: payable.data,
    snapshot: snapshot.data,
    marketplaceReturn: marketplaceReturn.data,
  };
}
