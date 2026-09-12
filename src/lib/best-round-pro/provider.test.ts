import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  conversationInterpretationSchema,
  normalizeInterpretationShape,
} from "./provider";

describe("conversation interpretation contract", () => {
  it("fills structural defaults and normalizes complete-set aliases", () => {
    const normalized = normalizeInterpretationShape({
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
});
