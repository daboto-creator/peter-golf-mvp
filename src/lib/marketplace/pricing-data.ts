import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type QuoteStatus =
  Database["public"]["Enums"]["marketplace_pricing_quote_status"];

const PAGE_SIZE = 20;

export async function getMarketplacePricingDetail(listingId: string) {
  const client = await createClient();
  const listingResult = await client
    .from("marketplace_listings")
    .select(
      "id, partner_id, status, approved_version_id, partner_profiles(user_id, status), marketplace_listing_versions!marketplace_listings_approved_version_fk(id, version_number, title, condition, specifications, evaluation_output, canonical_model_id, category_id, brand_id, brands(name), categories(name, category_spec_profiles(family, club_type, bag_type, set_type)), catalog_product_models(model_name))",
    )
    .eq("id", listingId)
    .maybeSingle();
  if (!listingResult.data)
    return {
      listing: null,
      quotes: [],
      analyses: [],
      error: listingResult.error,
    };
  const [quotes, analyses] = await Promise.all([
    client
      .from("marketplace_pricing_quotes")
      .select("*")
      .eq("listing_id", listingId)
      .order("quote_version", { ascending: false }),
    client
      .from("marketplace_market_analyses")
      .select(
        "id, source, status, provider, provider_status, valid_comparable_count, excluded_comparable_count, median_price, average_price, low_market, high_market, recommended_price, confidence, flags, checked_at, expires_at, created_at",
      )
      .eq("listing_id", listingId)
      .order("created_at", { ascending: false }),
  ]);
  return {
    listing: listingResult.data,
    quotes: quotes.data ?? [],
    analyses: (analyses.data ?? []).map((analysis) => ({
      ...analysis,
      isStale:
        analysis.expires_at !== null &&
        new Date(analysis.expires_at).getTime() <= Date.now(),
    })),
    error: listingResult.error ?? quotes.error ?? analyses.error,
  };
}

export async function listMarketplacePricingForOperations(
  page: number,
  status?: QuoteStatus,
) {
  const client = await createClient();
  const start = (page - 1) * PAGE_SIZE;
  let query = client
    .from("marketplace_pricing_quotes")
    .select(
      "*, marketplace_listings(status), listing_version:marketplace_listing_versions!marketplace_pricing_quote_listing_version_fk(title, version_number), partner_profiles(commercial_name, first_name, last_name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(start, start + PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  const result = await query;
  return {
    data: result.data ?? [],
    count: result.count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    error: result.error,
  };
}

export async function getMarketplacePricingQuoteForOperations(quoteId: string) {
  const client = await createClient();
  const quote = await client
    .from("marketplace_pricing_quotes")
    .select(
      "*, marketplace_listings(status), listing_version:marketplace_listing_versions!marketplace_pricing_quote_listing_version_fk(title, version_number, condition, specifications, evaluation_output, brands(name), categories(name), catalog_product_models(model_name)), partner_profiles(commercial_name, first_name, last_name, status)",
    )
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote.data)
    return { quote: null, comparables: [], history: [], error: quote.error };
  const [comparables, history] = await Promise.all([
    quote.data.market_analysis_id
      ? client
          .from("marketplace_market_comparables")
          .select("*")
          .eq("analysis_id", quote.data.market_analysis_id)
          .order("match_score", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    client
      .from("marketplace_pricing_status_history")
      .select("*")
      .eq("quote_id", quoteId)
      .order("created_at", { ascending: false }),
  ]);
  return {
    quote: quote.data,
    comparables: comparables.data ?? [],
    history: history.data ?? [],
    error: quote.error ?? comparables.error ?? history.error,
  };
}

export async function listPendingMarketplaceAnalysisRequests() {
  const client = await createClient();
  const result = await client
    .from("marketplace_market_analyses")
    .select(
      "id, listing_id, listing_version_id, requested_at, listing_version:marketplace_listing_versions!marketplace_market_analysis_listing_version_fk(title)",
    )
    .eq("status", "REQUESTED")
    .order("requested_at")
    .limit(50);
  return { data: result.data ?? [], error: result.error };
}
