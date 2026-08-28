import "server-only";

import { serverEnv } from "@/env/server";
import { getActivationEnvironmentBlockers } from "@/lib/marketplace/publication-rules";
import { createClient } from "@/lib/supabase/server";

export type MarketplacePublicationReadiness = {
  listingId: string;
  publicationReady: boolean;
  published: boolean;
  blockers: string[];
};

export async function getMarketplacePublicationReadiness(
  listingId?: string,
): Promise<MarketplacePublicationReadiness[]> {
  const client = await createClient();
  const { data, error } = await client.rpc(
    "get_marketplace_publication_readiness",
    { requested_listing_id: listingId ?? undefined },
  );
  if (error) return [];
  return data.map((entry) => ({
    listingId: entry.listing_id,
    publicationReady: entry.publication_ready,
    published: entry.published,
    blockers: entry.blockers,
  }));
}

export type MarketplaceActivationReadiness = {
  schemaVersion: string;
  enabled: boolean;
  ready: boolean;
  eligibleListingCount: number;
  databaseBlockers: string[];
  environmentBlockers: string[];
};

export async function getMarketplaceActivationReadiness(): Promise<MarketplaceActivationReadiness | null> {
  const client = await createClient();
  const { data, error } = await client
    .rpc("get_marketplace_activation_readiness")
    .maybeSingle();
  if (error || !data) return null;
  const environmentBlockers = getActivationEnvironmentBlockers({
    appEnvironment: serverEnv.APP_ENV,
    supabaseUrl: serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    marketplaceDeploymentEnabled: serverEnv.MARKETPLACE_ENABLED,
    paymentsMode: serverEnv.PAYMENTS_MODE,
    stripeMode: serverEnv.STRIPE_CHECKOUT_MODE,
    stripeSecretKey: serverEnv.STRIPE_SECRET_KEY,
    stripeWebhookSecret: serverEnv.STRIPE_WEBHOOK_SECRET,
    serviceRoleKey: serverEnv.SUPABASE_SERVICE_ROLE_KEY,
  });
  return {
    schemaVersion: data.schema_version,
    enabled: data.enabled,
    ready: data.ready && environmentBlockers.length === 0,
    eligibleListingCount: Number(data.eligible_listing_count),
    databaseBlockers: data.blockers,
    environmentBlockers,
  };
}
