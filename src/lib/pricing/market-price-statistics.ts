import type {
  MarketPriceInput,
  MarketPriceResult,
  MarketPriceSource,
} from "@/lib/pricing/market-price-provider";
import {
  evaluateComparable,
  normalizeMarketText,
  type RawMarketComparable,
} from "@/lib/pricing/market-price-matching";

function divideRoundHalfUp(total: bigint, divisor: bigint): number {
  return Number((total + divisor / BigInt(2)) / divisor);
}

export function medianMinorUnits(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return divideRoundHalfUp(
    BigInt(sorted[middle - 1]) + BigInt(sorted[middle]),
    BigInt(2),
  );
}

export function averageMinorUnits(values: number[]): number | null {
  if (values.length === 0) return null;
  return divideRoundHalfUp(
    values.reduce((sum, value) => sum + BigInt(value), BigInt(0)),
    BigInt(values.length),
  );
}

function percentile(sorted: number[], fraction: number): number {
  return sorted[Math.floor((sorted.length - 1) * fraction)];
}

function removePriceOutliers(
  sources: MarketPriceSource[],
): MarketPriceSource[] {
  if (sources.length < 5) return sources;
  const prices = sources.map((source) => source.priceMxn).sort((a, b) => a - b);
  const q1 = percentile(prices, 0.25);
  const q3 = percentile(prices, 0.75);
  const iqr = q3 - q1;
  if (iqr === 0) return sources;
  const lower = q1 - Math.ceil(iqr * 1.5);
  const upper = q3 + Math.ceil(iqr * 1.5);
  return sources.filter(
    (source) => source.priceMxn >= lower && source.priceMxn <= upper,
  );
}

export function buildMarketPriceResult(input: {
  product: MarketPriceInput;
  comparables: RawMarketComparable[];
  provider: string;
  searchQuery: string;
  checkedAt: string;
}): MarketPriceResult {
  const deduplicated = new Map<string, RawMarketComparable>();
  for (const candidate of input.comparables) {
    const key =
      candidate.identifier ??
      [
        normalizeMarketText(candidate.merchant),
        normalizeMarketText(candidate.productName),
        candidate.priceMxn,
      ].join(":");
    if (!deduplicated.has(key)) deduplicated.set(key, candidate);
  }

  const evaluated: MarketPriceSource[] = [];
  let excludedCount = input.comparables.length - deduplicated.size;
  for (const candidate of deduplicated.values()) {
    const match = evaluateComparable(input.product, candidate);
    if (!match.accepted || candidate.availability === "out_of_stock") {
      excludedCount += 1;
      continue;
    }
    evaluated.push({
      ...candidate,
      matchScore: match.score,
      matchConfidence: match.confidence,
      checkedAt: input.checkedAt,
    });
  }

  const sources = removePriceOutliers(evaluated);
  excludedCount += evaluated.length - sources.length;
  const prices = sources.map((source) => source.priceMxn);
  const merchantCount = new Set(
    sources.map((source) => normalizeMarketText(source.merchant)),
  ).size;
  const averageScore = sources.length
    ? sources.reduce((total, source) => total + source.matchScore, 0) /
      sources.length
    : 0;
  const sameCondition = sources.every(
    (source) => source.condition === input.product.condition,
  );
  const allMexican = sources.every((source) => source.marketScope === "mexico");
  const onlyInternational = sources.every(
    (source) => source.marketScope === "international",
  );
  const allHighMatches = sources.every(
    (source) => source.matchConfidence === "high",
  );
  const confidence =
    sources.length >= 3 &&
    merchantCount >= 2 &&
    averageScore >= 85 &&
    sameCondition &&
    allHighMatches &&
    allMexican
      ? "high"
      : sources.length >= 2 && averageScore >= 70 && !onlyInternational
        ? "medium"
        : sources.length >= 1
          ? "low"
          : "unavailable";

  return {
    medianPriceMxn: medianMinorUnits(prices),
    averagePriceMxn: averageMinorUnits(prices),
    lowPriceMxn: prices.length ? Math.min(...prices) : null,
    highPriceMxn: prices.length ? Math.max(...prices) : null,
    sampleSize: sources.length,
    confidence,
    source: sources.length ? `${input.provider} · Google Shopping MX` : null,
    sourceUrl: null,
    checkedAt: input.checkedAt,
    provider: input.provider,
    searchQuery: input.searchQuery,
    sources,
    excludedCount,
  };
}
