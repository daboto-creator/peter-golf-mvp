import { describe, expect, it } from "vitest";
import {
  calculateIntelligenceMetrics,
  calculateResaleSignal,
  calculateSourceReliability,
  estimateLearnedRotation,
  validLearningOutcomes,
  type IntelligenceOutcome,
} from "@/lib/pricing/intelligence-learning";

const row = (
  id: string,
  sold: number,
  reference = 100000,
  days = 24,
): IntelligenceOutcome => ({
  id,
  source: "FIRST_PARTY",
  brand: "Titleist",
  canonicalModel: "GT3",
  category: "Driver",
  condition: "used",
  acquisitionCostMinor: 40000,
  recommendedPriceMinor: reference,
  finalSoldPriceMinor: sold,
  marketReferenceMinor: reference,
  recommendationAccepted: true,
  listedAt: "2026-01-01T00:00:00Z",
  soldAt: "2026-01-25T00:00:00Z",
  daysInInventory: days,
  validEconomicSale: true,
});

describe("Intelligence learning", () => {
  it("filters invalid outcomes and produces a conservative resale signal", () => {
    const signal = calculateResaleSignal(
      [
        row("1", 103000),
        row("2", 104000),
        row("3", 102000),
        { ...row("bad", 500000), validEconomicSale: false },
      ],
      "Titleist",
      "GT3",
    );
    expect(
      validLearningOutcomes([
        row("1", 100000),
        { ...row("x", 100000), synthetic: true },
      ]),
    ).toHaveLength(1);
    expect(signal.sampleSize).toBe(3);
    expect(signal.confidence).toBe("LOW");
    expect(signal.resaleIndexBps).toBe(10300);
  });
  it("shrinks small source samples toward neutral", () => {
    const signal = calculateSourceReliability([
      {
        source: "retailer",
        accepted: true,
        similarity: 95,
        observedPriceMinor: 100000,
        actualSoldPriceMinor: 100000,
        observedAt: "2026-01-01",
      },
    ]);
    expect(signal.reliability).toBeGreaterThanOrEqual(60);
    expect(signal.reliability).toBeLessThanOrEqual(80);
    expect(signal.consistency).toBe("LIMITED");
  });
  it("calculates robust KPI rates and signed errors", () => {
    const metrics = calculateIntelligenceMetrics({
      outcomes: [row("1", 99000), row("2", 101000), row("3", 100000)],
      recommendationsPresented: 4,
      acceptedRecommendations: 3,
      analyses: [
        { resolvedWithoutExternal: true, cacheHit: true, usaFallback: false },
        { resolvedWithoutExternal: false, cacheHit: false, usaFallback: true },
      ],
      overrides: 1,
    });
    expect(metrics.recommendationAcceptanceRateBps).toBe(7500);
    expect(metrics.medianSuggestedVsSoldBps).toBe(0);
    expect(metrics.resolvedWithoutExternalRateBps).toBe(5000);
  });
  it("learns rotation from median days", () => {
    expect(estimateLearnedRotation([10, 22, 29], "UNKNOWN")).toBe("FAST");
    expect(estimateLearnedRotation([], "MEDIUM")).toBe("MEDIUM");
  });
});
