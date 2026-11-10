import { describe, expect, it } from "vitest";

import { evaluateCorpus } from "../../../evals/best-round-pro/evaluator";
import { bestRoundProScenarios } from "../../../evals/best-round-pro/scenarios";

describe("Best Round Pro deterministic quality corpus", () => {
  it("is versioned, complete, and includes the declared category allocation", () => {
    const report = evaluateCorpus(bestRoundProScenarios);
    expect(report.scenarioCount).toBe(110);
    expect(report.providerScenarios).toHaveLength(21);
    expect(report.categoryCounts).toEqual({
      Beginner: 10,
      "Handicap / level": 8,
      Handedness: 8,
      Driver: 12,
      "Fairway / Hybrid": 8,
      Irons: 8,
      Wedges: 8,
      Putter: 6,
      "Budget / objections": 10,
      "Mi Golf": 8,
      "Product context": 8,
      "Stock / catalog": 8,
      "Difficult conversation / loops": 8,
    });
    console.info("best_round_pro_deterministic_eval", {
      scenarioCount: report.scenarioCount,
      intentAccuracy: report.intentAccuracy,
      fallbackRouteCounts: report.fallbackRouteCounts,
      categoryAccuracy: report.categoryAccuracy,
      categoryMeasured: report.categoryMeasured,
      recipientAccuracy: report.recipientAccuracy,
      recipientMeasured: report.recipientMeasured,
      providerScenarioCount: report.providerScenarios.length,
      categoryMismatches: report.categoryMismatches,
      recipientMismatches: report.recipientMismatches,
      notMeasured: report.notMeasured,
    });
    expect(report.categoryAccuracy).toBeGreaterThanOrEqual(0.95);
    expect(report.recipientAccuracy).toBe(1);
    expect(report.intentAccuracy).toBeNull();
  });

  it("records the outcome and forbidden-result contract on every case", () => {
    for (const scenario of bestRoundProScenarios) {
      expect(scenario.id).toMatch(/^brp-v1-/);
      expect(scenario.userMessages.length).toBeGreaterThan(0);
      expect(scenario.expectedIntent).toBeTruthy();
      expect(scenario.requiredOutcome).toBeTruthy();
      expect(scenario.forbiddenOutcome.length).toBeGreaterThan(0);
    }
  });
});
