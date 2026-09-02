import { ratioToBps } from "@/lib/pricing/money";

export const LEARNING_VERSION = "intelligence-learning-v1";
export const RESALE_INDEX_VERSION = "resale-index-v1";
export const SOURCE_RELIABILITY_VERSION = "source-reliability-v1";
export const ROTATION_LEARNING_VERSION = "rotation-learning-v1";

export type IntelligenceOutcome = {
  id: string;
  source: "FIRST_PARTY" | "MARKETPLACE";
  brand: string | null;
  canonicalModel: string | null;
  category: string | null;
  condition: string | null;
  acquisitionCostMinor: number | null;
  recommendedPriceMinor: number | null;
  finalSoldPriceMinor: number;
  marketReferenceMinor: number | null;
  recommendationAccepted: boolean | null;
  listedAt: string | null;
  soldAt: string;
  daysInInventory: number | null;
  researchConfidence?: string | null;
  validEconomicSale: boolean;
  synthetic?: boolean;
};

export type ComparableSourceObservation = {
  source: string;
  accepted: boolean;
  similarity: number;
  observedPriceMinor: number | null;
  actualSoldPriceMinor: number | null;
  observedAt: string;
};

export type ResaleSignal = {
  brand: string;
  model: string;
  sampleSize: number;
  resaleIndex: number | null;
  resaleIndexBps: number | null;
  medianDaysToSale: number | null;
  confidence: "INSUFFICIENT_DATA" | "LOW" | "MEDIUM" | "HIGH";
  version: string;
};

export type SourceReliabilitySignal = {
  source: string;
  baseQuality: number;
  reliability: number;
  sampleSize: number;
  acceptedRateBps: number;
  medianPriceErrorBps: number | null;
  consistency: "HIGH" | "NORMAL" | "LIMITED" | "LOW";
  version: string;
};

export function validLearningOutcomes(
  outcomes: readonly IntelligenceOutcome[],
): IntelligenceOutcome[] {
  return outcomes.filter(
    (outcome) =>
      outcome.validEconomicSale &&
      !outcome.synthetic &&
      outcome.finalSoldPriceMinor > 0,
  );
}

function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function calculateResaleSignal(
  outcomes: readonly IntelligenceOutcome[],
  brand: string,
  model: string,
): ResaleSignal {
  const rows = validLearningOutcomes(outcomes).filter(
    (row) =>
      row.brand === brand &&
      row.canonicalModel === model &&
      row.marketReferenceMinor &&
      row.marketReferenceMinor > 0,
  );
  const ratios = rows.map((row) =>
    Math.round((row.finalSoldPriceMinor * 10_000) / row.marketReferenceMinor!),
  );
  const indexBps = median(ratios);
  const sampleSize = rows.length;
  return {
    brand,
    model,
    sampleSize,
    resaleIndex: indexBps === null ? null : indexBps / 10_000,
    resaleIndexBps: indexBps,
    medianDaysToSale: median(
      rows
        .map((row) => row.daysInInventory)
        .filter((value): value is number => value !== null && value >= 0),
    ),
    confidence:
      sampleSize < 3
        ? "INSUFFICIENT_DATA"
        : sampleSize < 5
          ? "LOW"
          : sampleSize < 10
            ? "MEDIUM"
            : "HIGH",
    version: RESALE_INDEX_VERSION,
  };
}

export function calculateSourceReliability(
  observations: readonly ComparableSourceObservation[],
  baseQuality = 70,
): SourceReliabilitySignal {
  const source = observations[0]?.source ?? "unknown";
  const rows = observations.filter((row) => row.source === source);
  const sampleSize = rows.length;
  const accepted = rows.filter((row) => row.accepted).length;
  const acceptedRateBps = sampleSize
    ? Math.round((accepted * 10_000) / sampleSize)
    : 5_000;
  const errors = rows.flatMap((row) =>
    row.observedPriceMinor && row.actualSoldPriceMinor
      ? [
          Math.abs(
            ratioToBps(
              row.observedPriceMinor - row.actualSoldPriceMinor,
              row.actualSoldPriceMinor,
            ),
          ),
        ]
      : [],
  );
  const medianError = median(errors);
  const raw = sampleSize
    ? Math.round(50 + acceptedRateBps / 200 - (medianError ?? 0) / 4)
    : 70;
  const shrink = sampleSize < 3 ? 0.25 : sampleSize < 10 ? 0.6 : 1;
  const reliability = Math.max(
    0,
    Math.min(100, Math.round(70 + (raw - 70) * shrink)),
  );
  return {
    source,
    baseQuality,
    reliability,
    sampleSize,
    acceptedRateBps,
    medianPriceErrorBps: medianError,
    consistency:
      sampleSize < 3
        ? "LIMITED"
        : reliability >= 80
          ? "HIGH"
          : reliability >= 60
            ? "NORMAL"
            : "LOW",
    version: SOURCE_RELIABILITY_VERSION,
  };
}

export type IntelligenceMetrics = {
  recommendationAcceptanceRateBps: number | null;
  medianSuggestedVsSoldBps: number | null;
  medianAbsoluteSuggestedVsSoldBps: number | null;
  resolvedWithoutExternalRateBps: number | null;
  cacheHitRateBps: number | null;
  usaFallbackRateBps: number | null;
  medianDaysToSale: number | null;
  overrideRateBps: number | null;
};

export function calculateIntelligenceMetrics(input: {
  outcomes: readonly IntelligenceOutcome[];
  recommendationsPresented: number;
  acceptedRecommendations: number;
  analyses: Array<{
    resolvedWithoutExternal: boolean;
    cacheHit: boolean;
    usaFallback: boolean;
  }>;
  overrides: number;
}): IntelligenceMetrics {
  const outcomes = validLearningOutcomes(input.outcomes);
  const diffs = outcomes.flatMap((row) =>
    row.recommendedPriceMinor && row.recommendedPriceMinor > 0
      ? [
          ratioToBps(
            row.finalSoldPriceMinor - row.recommendedPriceMinor,
            row.recommendedPriceMinor,
          ),
        ]
      : [],
  );
  const rate = (value: number, denominator: number): number | null =>
    denominator > 0 ? Math.round((value * 10_000) / denominator) : null;
  const medianDiff = median(diffs);
  return {
    recommendationAcceptanceRateBps: rate(
      input.acceptedRecommendations,
      input.recommendationsPresented,
    ),
    medianSuggestedVsSoldBps: medianDiff,
    medianAbsoluteSuggestedVsSoldBps: median(diffs.map(Math.abs)),
    resolvedWithoutExternalRateBps: rate(
      input.analyses.filter((row) => row.resolvedWithoutExternal).length,
      input.analyses.length,
    ),
    cacheHitRateBps: rate(
      input.analyses.filter((row) => row.cacheHit).length,
      input.analyses.length,
    ),
    usaFallbackRateBps: rate(
      input.analyses.filter((row) => row.usaFallback).length,
      input.analyses.length,
    ),
    medianDaysToSale: median(
      outcomes
        .map((row) => row.daysInInventory)
        .filter((value): value is number => value !== null && value >= 0),
    ),
    overrideRateBps: rate(input.overrides, input.recommendationsPresented),
  };
}

export function estimateLearnedRotation(
  days: readonly number[],
  fallback: "FAST" | "MEDIUM" | "SLOW" | "UNKNOWN",
): "FAST" | "MEDIUM" | "SLOW" | "UNKNOWN" {
  const value = median(days.filter((day) => Number.isFinite(day) && day >= 0));
  if (value === null) return fallback;
  if (value <= 30) return "FAST";
  if (value <= 60) return "MEDIUM";
  return "SLOW";
}
