import type { MarketPriceResult } from "@/lib/pricing/market-price-provider";
import type {
  MarketplaceMarketAnalysisResult,
  MarketplaceNormalizedComparable,
} from "@/lib/pricing/marketplace-pricing-types";

export const MARKETPLACE_ANALYSIS_VERSION = "marketplace-market-v1";

function safeReferenceUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

export function normalizeMarketplaceMarketResult(
  result: MarketPriceResult,
): MarketplaceMarketAnalysisResult {
  const comparables: MarketplaceNormalizedComparable[] = result.sources.map(
    (source) => ({
      source: result.provider,
      title: source.productName,
      brand: null,
      model: null,
      category: null,
      condition: source.condition,
      priceMinor: source.priceMxn,
      currency: "MXN",
      seller: source.merchant,
      referenceUrl: safeReferenceUrl(source.url),
      availability: source.availability,
      shippingMinor: null,
      totalPriceMinor: null,
      matchScore: source.matchScore,
      matchReasons: [],
      observedAt: source.checkedAt,
    }),
  );
  const confidence =
    result.confidence === "high"
      ? "HIGH"
      : result.confidence === "medium"
        ? "MEDIUM"
        : result.confidence === "low"
          ? "LOW"
          : "INSUFFICIENT";
  const flags: string[] = [];
  if (result.excludedCount > 0) flags.push("COMPARABLES_EXCLUDED");
  if (result.confidence === "low") flags.push("LOW_CONFIDENCE");
  if (!result.sampleSize) flags.push("NO_VALID_COMPARABLES");
  return {
    status:
      result.provider === "unavailable"
        ? "PROVIDER_UNAVAILABLE"
        : result.medianPriceMxn === null
          ? "INSUFFICIENT_DATA"
          : "COMPLETE",
    validComparableCount: result.sampleSize,
    medianPriceMinor: result.medianPriceMxn,
    averagePriceMinor: result.averagePriceMxn,
    lowMarketMinor: result.lowPriceMxn,
    highMarketMinor: result.highPriceMxn,
    recommendedPriceMinor: result.medianPriceMxn,
    confidence,
    flags,
    analysisVersion: MARKETPLACE_ANALYSIS_VERSION,
    comparables,
  };
}
