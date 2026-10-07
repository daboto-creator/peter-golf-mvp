import { describe, expect, it } from "vitest";

import {
  MEMORY_POLICY,
  nextBestQuestion,
  resolveRecipientContext,
  canOverwriteDurableFact,
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
    expect(nextBestQuestion("driver", {})?.id).toBe("handedness");
    expect(
      nextBestQuestion("putter", { objective: true, handedness: "right" })?.id,
    ).toBe("length");
    expect(nextBestQuestion("apparel", { productType: "polo" })).toBeNull();
    expect(
      nextBestQuestion("driver", {
        objective: true,
        handedness: "right",
        shotTendency: "straight",
        swingSpeed: 95,
      }),
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
      candidateInventory: [],
    };
    expect(request.candidateInventory).toEqual([]);
  });

  it("isolates third-party recipient language and supports returning to self", () => {
    expect(resolveRecipientContext("Estoy buscando un driver para mi esposa", "SELF")).toBe("THIRD_PARTY");
    expect(resolveRecipientContext("ella es zurda y está empezando", "THIRD_PARTY")).toBe("THIRD_PARTY");
    expect(resolveRecipientContext("ahora volvamos a buscar para mí", "THIRD_PARTY")).toBe("SELF");
  });

  it("keeps manual edits authoritative while allowing explicit corrections", () => {
    expect(canOverwriteDurableFact({ existingSource: "USER_MANUAL_EDIT", incomingSource: "AI_INFERENCE" })).toBe(false);
    expect(canOverwriteDurableFact({ existingSource: "USER_MANUAL_EDIT", incomingSource: "USER_DECLARED" })).toBe(false);
    expect(canOverwriteDurableFact({ existingSource: "USER_MANUAL_EDIT", incomingSource: "USER_DECLARED", explicitCorrection: true })).toBe(true);
    expect(canOverwriteDurableFact({ existingSource: "DERIVED", incomingSource: "USER_DECLARED" })).toBe(true);
  });
});
