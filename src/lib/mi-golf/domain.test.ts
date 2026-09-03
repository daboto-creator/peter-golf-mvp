import { describe, expect, it } from "vitest";

import {
  MEMORY_POLICY,
  nextBestQuestion,
  validateHandicap,
  type BestRoundRecommendationRequest,
} from "@/lib/mi-golf/domain";

describe("Mi Golf foundation contracts", () => {
  it("validates bounded handicap values and keeps temporary context out of durable policy", () => {
    expect(validateHandicap(14)).toBe(true);
    expect(validateHandicap(55)).toBe(false);
    expect(MEMORY_POLICY.sessionOnly).toContain("temporary budget");
    expect(MEMORY_POLICY.autoSave).toContain("explicit handedness");
  });

  it("prioritizes category-relevant questions and stops when enough is known", () => {
    expect(nextBestQuestion("driver", {})?.id).toBe("objective");
    expect(
      nextBestQuestion("putter", { objective: true, handedness: "right" })?.id,
    ).toBe("length");
    expect(nextBestQuestion("apparel", { productType: "polo" })).toBeNull();
    expect(
      nextBestQuestion("driver", { objective: true, handedness: "right" }),
    ).toBeNull();
  });

  it("keeps technical, personal and commercial contracts separate", () => {
    const request: BestRoundRecommendationRequest = {
      golferContext: null,
      equipment: [],
      objectives: [],
      sessionContext: {
        requestedCategory: "driver",
        purchaseIntent: "EXPLORING",
        budgetMxnMinor: 800000,
        objections: [],
        productsConsidered: [],
        diagnosticAnswers: {},
        unresolvedQuestions: [],
        summary: null,
      },
      requestedCategory: "driver",
      candidateInventory: [
        {
          id: "inventory-1",
          source: "FIRST_PARTY",
          category: "driver",
          brand: "TaylorMade",
          model: "Qi10",
          condition: "used",
          priceMxnMinor: 800000,
          availability: "AVAILABLE",
          specifications: { handedness: "right", loft: 10.5 },
        },
      ],
    };
    expect(request.candidateInventory[0]).toHaveProperty("priceMxnMinor");
    expect(request.candidateInventory[0].specifications).not.toHaveProperty(
      "margin",
    );
  });
});
