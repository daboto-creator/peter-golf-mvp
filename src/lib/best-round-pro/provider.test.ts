import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  conversationInterpretationSchema,
  normalizeInterpretationShape,
  providerValidationIssues,
} from "./provider";
import { DIALOGUE_ACTS, SEARCH_SCOPE_MODES } from "./contract";

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

  it("accepts canonical handicap facts and rejects out-of-range values", () => {
    const valid = conversationInterpretationSchema.safeParse(normalizeInterpretationShape({
      dialogueAct: "ANSWER_PENDING_QUESTION",
      intent: "UNKNOWN",
      declaredFacts: [{ field: "handicapIndex", value: 18.4, durable: true, semanticStatus: "KNOWN", source: "CURRENT_USER_PENDING_ANSWER" }],
    }));
    expect(valid.success).toBe(true);
    const invalid = conversationInterpretationSchema.safeParse(normalizeInterpretationShape({
      dialogueAct: "ANSWER_PENDING_QUESTION",
      intent: "UNKNOWN",
      declaredFacts: [{ field: "handicapIndex", value: 55, durable: true, semanticStatus: "KNOWN", source: "CURRENT_USER_PENDING_ANSWER" }],
    }));
    expect(invalid.success).toBe(false);
  });

  it("accepts typed wedge loft arrays", () => {
    const parsed = conversationInterpretationSchema.parse(normalizeInterpretationShape({
      dialogueAct: "ANSWER_PENDING_QUESTION",
      intent: "UNKNOWN",
      declaredFacts: [{ field: "currentWedgeLofts", value: [50, 54, 58], durable: true, semanticStatus: "KNOWN", source: "CURRENT_USER_PENDING_ANSWER" }],
    }));
    expect(parsed.declaredFacts[0].value).toEqual([50, 54, 58]);
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
    expect(parsed.searchScopeMode).toBe("ALL_EQUIPMENT");
    expect(parsed.requestedProductFamilies).toEqual([]);
    expect(SEARCH_SCOPE_MODES).toEqual(["EXACT", "MULTI_FAMILY", "ALL_CLUBS", "ALL_EQUIPMENT"]);
  });

  it("validates the exact broad-left provider contract without fallback", () => {
    const parsed = conversationInterpretationSchema.safeParse(
      normalizeInterpretationShape({
        dialogueAct: "CATALOG_SEARCH",
        intent: "ACTIVE_RESEARCH",
        category: null,
        requestedProductFamilies: [],
        catalogScopeIntent: "ALL_HANDED_EQUIPMENT",
        searchScopeMode: "ALL_EQUIPMENT",
        declaredFacts: [{ field: "handedness", value: "LEFT", durable: true, semanticStatus: "KNOWN", source: "CURRENT_USER_EXPLICIT" }],
        factMutationIntent: "SET_NEW",
      }),
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.dialogueAct).toBe("CATALOG_SEARCH");
    expect(parsed.data.catalogScopeIntent).toBe("ALL_HANDED_EQUIPMENT");
    expect(parsed.data.searchScopeMode).toBe("ALL_EQUIPMENT");
    expect(parsed.data.declaredFacts[0]).toMatchObject({ field: "handedness", value: "LEFT", semanticStatus: "KNOWN", source: "CURRENT_USER_EXPLICIT" });
  });

  it("normalizes a provider concept collision to the canonical search mode", () => {
    const parsed = conversationInterpretationSchema.parse(
      normalizeInterpretationShape({
        dialogueAct: "CATALOG_SEARCH",
        intent: "ACTIVE_RESEARCH",
        catalogScopeIntent: "ALL_HANDED_EQUIPMENT",
        searchScopeMode: "ALL_HANDED_EQUIPMENT",
      }),
    );
    expect(parsed.catalogScopeIntent).toBe("ALL_HANDED_EQUIPMENT");
    expect(parsed.searchScopeMode).toBe("ALL_EQUIPMENT");
  });

  it("reports a safe scalar receivedValue for enum validation failures", () => {
    expect(providerValidationIssues({
      dialogueAct: "CATALOG_SEARCH",
      intent: "ACTIVE_RESEARCH",
      searchScopeMode: "UNSUPPORTED_SCOPE",
    })).toContainEqual(expect.objectContaining({
      field: "searchScopeMode",
      path: "searchScopeMode",
      code: "invalid_value",
      receivedValue: "UNSUPPORTED_SCOPE",
    }));
  });

  it("keeps planner question actions out of the canonical user DialogueAct contract", () => {
    expect(DIALOGUE_ACTS).not.toContain("ASK_SET_EXPERIENCE");
    expect(DIALOGUE_ACTS).not.toContain("ASK_PLAYER_SKILL_LEVEL");
    const valid = conversationInterpretationSchema.parse(normalizeInterpretationShape({
      dialogueAct: "OTHER",
      intent: "UNKNOWN",
    }));
    expect(conversationInterpretationSchema.safeParse({ ...valid, dialogueAct: "ASK_SET_EXPERIENCE" }).success).toBe(false);
    expect(conversationInterpretationSchema.safeParse({ ...valid, dialogueAct: "ASK_PLAYER_SKILL_LEVEL" }).success).toBe(false);
  });

  it("normalizes a legacy planner label safely while retaining its pending fact", () => {
    const parsed = conversationInterpretationSchema.parse(normalizeInterpretationShape({
      dialogueAct: "ASK_PLAYER_SKILL_LEVEL",
      intent: "UNKNOWN",
      declaredFacts: [{
        field: "skill",
        value: "BEGINNER",
        durable: true,
        semanticStatus: "KNOWN",
        source: "CURRENT_USER_PENDING_ANSWER",
      }],
      factMutationIntent: "SET_NEW",
    }));
    expect(parsed.dialogueAct).toBe("OTHER");
    expect(parsed.declaredFacts[0]).toMatchObject({ field: "skill", value: "BEGINNER" });
  });
});
