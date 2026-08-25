import { describe, expect, it } from "vitest";

import {
  displayScore,
  highestEligibleTier,
  promotionTrackingForEligibleTier,
  scoreStatusForOrders,
  smoothScoreBps,
  stabilityReached,
  weightedScoreBps,
  type TierRequirement,
} from "@/lib/marketplace/score-tier-rules";

const requirements: TierRequirement[] = [
  { tier: "BOGEY", minimumAverage: 0, minimumScoreBps: 0 },
  { tier: "PAR", minimumAverage: 6, minimumScoreBps: 6500 },
  { tier: "BIRDIE", minimumAverage: 16, minimumScoreBps: 7500 },
  { tier: "ALBATROSS", minimumAverage: 31, minimumScoreBps: 8500 },
  { tier: "HOLE_IN_ONE", minimumAverage: 76, minimumScoreBps: 9200 },
];

describe("Partner Score and Tier rules", () => {
  it("uses the approved 80-point Bayesian prior and converges with evidence", () => {
    expect(smoothScoreBps(0, 0)).toBe(8000);
    expect(smoothScoreBps(50_000, 5)).toBe(8667);
    expect(smoothScoreBps(0, 5)).toBe(5333);
  });

  it("weights seven components and bounds penalties", () => {
    const weights = [2500, 2000, 1500, 1500, 1000, 1000, 500];
    expect(weights.reduce((total, weight) => total + weight, 0)).toBe(10_000);
    expect(
      weightedScoreBps(
        weights.map((weightBps) => ({ scoreBps: 8000, weightBps })),
        500,
      ),
    ).toEqual({ weighted: 8000, final: 7500 });
    expect(
      weightedScoreBps([{ scoreBps: 0, weightBps: 10_000 }], 5000).final,
    ).toBe(0);
  });

  it("switches from provisional at the configurable fifth completed order", () => {
    expect(scoreStatusForOrders(4)).toBe("PROVISIONAL");
    expect(scoreStatusForOrders(5)).toBe("ESTABLISHED");
  });

  it("selects the highest tier satisfying both score and volume", () => {
    expect(highestEligibleTier(120, 7200, "ESTABLISHED", requirements)).toBe(
      "PAR",
    );
    expect(highestEligibleTier(20, 9000, "ESTABLISHED", requirements)).toBe(
      "BIRDIE",
    );
    expect(highestEligibleTier(2, 9500, "ESTABLISHED", requirements)).toBe(
      "BOGEY",
    );
  });

  it("caps provisional Partners at Par", () => {
    expect(highestEligibleTier(120, 10_000, "PROVISIONAL", requirements)).toBe(
      "PAR",
    );
  });

  it("counts consecutive periods inclusively", () => {
    expect(stabilityReached("2026-09-01", "2026-09-06", 7)).toBe(false);
    expect(stabilityReached("2026-09-01", "2026-09-07", 7)).toBe(true);
    expect(stabilityReached("2026-09-01", "2026-09-14", 14)).toBe(true);
  });

  it("binds promotion stability to the specific eligible tier", () => {
    expect(
      promotionTrackingForEligibleTier(
        "BOGEY",
        "PAR",
        null,
        null,
        "2026-09-01",
      ),
    ).toEqual({ candidate: "PAR", eligibleSince: "2026-09-01" });
    expect(
      promotionTrackingForEligibleTier(
        "BOGEY",
        "PAR",
        "PAR",
        "2026-09-01",
        "2026-09-06",
      ),
    ).toEqual({ candidate: "PAR", eligibleSince: "2026-09-01" });
    expect(
      promotionTrackingForEligibleTier(
        "BOGEY",
        "BIRDIE",
        "PAR",
        "2026-09-01",
        "2026-09-04",
      ),
    ).toEqual({ candidate: "BIRDIE", eligibleSince: "2026-09-04" });
    expect(
      promotionTrackingForEligibleTier(
        "BOGEY",
        "HOLE_IN_ONE",
        "PAR",
        "2026-09-01",
        "2026-09-07",
      ),
    ).toEqual({ candidate: "HOLE_IN_ONE", eligibleSince: "2026-09-07" });
  });

  it("clears promotion tracking when eligibility is not above current tier", () => {
    expect(
      promotionTrackingForEligibleTier(
        "PAR",
        "PAR",
        "BIRDIE",
        "2026-09-01",
        "2026-09-05",
      ),
    ).toEqual({ candidate: null, eligibleSince: null });
  });

  it("rounds internal basis points consistently for display", () => {
    expect(displayScore(8567)).toBe(86);
  });
});
