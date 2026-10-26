const REQUIRED_NONNEGATIVE_ECONOMICS_FIELDS = [
  "commissionMinor",
  "commissionVatMinor",
  "processingTotalMinor",
  "adminPercentageFeeMinor",
  "adminFixedFeeMinor",
  "estimatedBestRoundRevenueMinor",
] as const;

export function getEffectiveReviewedPriceMinor(
  pricing: Record<string, unknown> | null | undefined,
) {
  const value = pricing?.approvedPriceMinor
    ?? pricing?.proposedPriceMinor
    ?? pricing?.calculatedPublicPriceMinor;
  const amount = Number(value ?? 0);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : 0;
}

export function getPartnerMarketplaceEconomicsCoherence(
  pricing: Record<string, unknown> | null | undefined,
) {
  const current = pricing ?? {};
  const economics = current.economics;
  const effectivePriceMinor = getEffectiveReviewedPriceMinor(current);
  if (!economics || typeof economics !== "object") {
    return { coherent: false as const, code: "MISSING_ECONOMICS" as const };
  }
  const snapshot = economics as Record<string, unknown>;
  if (effectivePriceMinor <= 0 || Number(snapshot.publicPriceMinor) !== effectivePriceMinor) {
    return { coherent: false as const, code: "PUBLIC_PRICE_MISMATCH" as const };
  }
  const partnerNet = Number(snapshot.partnerNetMinor);
  if (!Number.isSafeInteger(partnerNet) || partnerNet <= 0) {
    return { coherent: false as const, code: "PARTNER_NET_INVALID" as const };
  }
  if (current.estimatedPartnerNetMinor != null && Number(current.estimatedPartnerNetMinor) !== partnerNet) {
    return { coherent: false as const, code: "PARTNER_NET_MISMATCH" as const };
  }
  for (const field of REQUIRED_NONNEGATIVE_ECONOMICS_FIELDS) {
    const value = Number(snapshot[field]);
    if (!Number.isSafeInteger(value) || value < 0) {
      return { coherent: false as const, code: "NEGATIVE_ECONOMICS" as const };
    }
  }
  if (snapshot.meetsMinimumMarketplaceRevenue === false) {
    return { coherent: false as const, code: "MINIMUM_REVENUE_NOT_MET" as const };
  }
  return { coherent: true as const, code: "COHERENT" as const };
}

export const PARTNER_PRICING_CONFIGURATION_POLICY =
  "REVIEWED_SNAPSHOT_AUTHORITATIVE" as const;
