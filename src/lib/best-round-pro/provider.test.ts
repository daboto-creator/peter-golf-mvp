import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  conversationInterpretationSchema,
  normalizeInterpretationShape,
} from "./provider";

describe("conversation interpretation contract", () => {
  it("fills structural defaults and normalizes complete-set aliases", () => {
    const normalized = normalizeInterpretationShape({
      dialogueAct: "CATALOG_SEARCH",
      category: "COMPLETE_SET",
      intent: "ACTIVE_RESEARCH",
    });
    const parsed = conversationInterpretationSchema.parse(normalized);
    expect(parsed.category).toBe("SET");
    expect(parsed.declaredFacts).toEqual([]);
    expect(parsed.entities.purchaseTarget).toBe("SELF");
  });

  it("accepts a minimal valid interpretation without questionnaire fields", () => {
    const parsed = conversationInterpretationSchema.parse(
      normalizeInterpretationShape({
        dialogueAct: "ANSWER_PENDING_QUESTION",
        intent: "UNKNOWN",
        confidence: 0.9,
      }),
    );
    expect(parsed.dialogueAct).toBe("ANSWER_PENDING_QUESTION");
    expect(parsed.wantsRecommendation).toBe(false);
  });

  it("keeps explicit multi-family search scope separate from product category", () => {
    const parsed = conversationInterpretationSchema.parse(
      normalizeInterpretationShape({
        dialogueAct: "CATALOG_SEARCH",
        intent: "ACTIVE_RESEARCH",
        category: null,
        requestedProductFamilies: ["DRIVER", "WEDGE"],
        searchScopeMode: "MULTI_FAMILY",
        confidence: 0.95,
      }),
    );
    expect(parsed.requestedProductFamilies).toEqual(["DRIVER", "WEDGE"]);
    expect(parsed.searchScopeMode).toBe("MULTI_FAMILY");
  });

  it("represents an all-clubs broadening without inheriting SET", () => {
    const parsed = conversationInterpretationSchema.parse(
      normalizeInterpretationShape({
        dialogueAct: "CATALOG_SEARCH",
        intent: "ACTIVE_RESEARCH",
        category: null,
        requestedProductFamilies: ["DRIVER", "FAIRWAY_WOOD", "HYBRID", "IRON", "WEDGE", "PUTTER"],
        searchScopeMode: "ALL_CLUBS",
        confidence: 0.95,
      }),
    );
    expect(parsed.requestedProductFamilies).not.toContain("SET");
    expect(parsed.searchScopeMode).toBe("ALL_CLUBS");
  });

  it("represents broad left-handed availability separately from explicit families", () => {
    const parsed = conversationInterpretationSchema.parse(
      normalizeInterpretationShape({
        dialogueAct: "CATALOG_SEARCH",
        intent: "ACTIVE_RESEARCH",
        category: "SET",
        requestedProductFamilies: [],
        catalogScopeIntent: "ALL_HANDED_EQUIPMENT",
        searchScopeMode: "ALL_EQUIPMENT",
        searchContinuationRelation: "KEEP_SCOPE",
        confidence: 0.95,
      }),
    );
    expect(parsed.catalogScopeIntent).toBe("ALL_HANDED_EQUIPMENT");
    expect(parsed.requestedProductFamilies).toEqual([]);
  });
});
