import { describe, expect, it } from "vitest";

import {
  classifyConversationTurn,
  initialConversationState,
  nextQuestionFor,
  priceObjectionReply,
  resolveContextualShortAnswer,
} from "./conversation";

describe("Best Round Pro conversation", () => {
  it("detects category and asks only the next material question", () => {
    const result = classifyConversationTurn(
      initialConversationState(),
      "Quiero un Driver",
    );
    expect(result.state.session.requestedCategory).toBe("DRIVER");
    expect(result.nextQuestion?.id).toBe("handedness");
    expect(result.state.session.unresolvedQuestions).toEqual(["handedness"]);
  });

  it("does not re-ask facts already in Mi Golf", () => {
    const profile = {
      userId: "u",
      handicap: 18,
      handedness: "RIGHT" as const,
      skillLevel: "INTERMEDIATE",
      playFrequency: null,
      shotTendency: "SLICE",
      preferences: {},
      source: "USER_DECLARED" as const,
      confidence: "HIGH" as const,
    };
    const state = initialConversationState();
    state.session.requestedCategory = "DRIVER";
    state.session.diagnosticAnswers.objective = "MORE_FORGIVENESS";
    expect(nextQuestionFor("DRIVER", profile, state.session)?.id).toBe(
      "swingSpeed",
    );
  });

  it("keeps an objection in session without restarting diagnosis", () => {
    const state = initialConversationState();
    state.session.requestedCategory = "DRIVER";
    const result = classifyConversationTurn(state, "Está muy caro");
    expect(result.objection).toBe("PRICE");
    expect(result.reply).toContain("precio");
    expect(result.state.session.objections).toContain("PRICE");
  });

  it("is deterministic for identical turns", () => {
    const a = classifyConversationTurn(
      initialConversationState(),
      "Quiero un Wedge",
    );
    const b = classifyConversationTurn(
      initialConversationState(),
      "Quiero un Wedge",
    );
    expect(a).toEqual(b);
  });

  it("marks an unknown answer and advances past swing speed", () => {
    const state = initialConversationState();
    state.session.requestedCategory = "DRIVER";
    state.session.diagnosticAnswers = {
      handedness: "RIGHT",
      objective: "MORE_FORGIVENESS",
      shotTendency: "SLICE",
    };
    const result = classifyConversationTurn(state, "No la conozco.");
    expect(result.state.session.diagnosticAnswers.swingSpeed).toBe(
      "ANSWERED_UNKNOWN",
    );
    expect(result.nextQuestion?.id).not.toBe("swingSpeed");
  });

  it("keeps price objection wording truthful", () => {
    expect(priceObjectionReply(true, false)).toContain("Mejor valor");
    expect(priceObjectionReply(false, true)).toContain("otra opción");
    expect(priceObjectionReply(false, false)).toContain("no tengo una opción");
  });

  it.each(["ni idea", "no", "no sé", "No la conozco"])(
    "resolves %s as unknown swing speed",
    (message) => {
      expect(
        resolveContextualShortAnswer({
          pendingQuestionKey: "swingSpeed",
          userMessage: message,
        })?.value,
      ).toBe("ANSWERED_UNKNOWN");
    },
  );

  it("resolves contextual no for used equipment as negative", () => {
    expect(
      resolveContextualShortAnswer({
        pendingQuestionKey: "acceptUsed",
        userMessage: "No",
      })?.value,
    ).toBe("NEW_ONLY");
  });
});
