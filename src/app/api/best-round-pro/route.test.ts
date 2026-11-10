import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  process: vi.fn(),
  telemetry: vi.fn(),
}));

vi.mock("@/lib/best-round-pro/service", () => ({
  processConversationTurn: mocks.process,
  getLastInterpreterTelemetry: mocks.telemetry,
}));

import { initialConversationState } from "@/lib/best-round-pro/conversation";
import { POST } from "./route";

function request(body: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/best-round-pro", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

describe("Best Round Pro API request limits and telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const state = initialConversationState();
    mocks.process.mockResolvedValue({
      state,
      reply: "¿Qué buscas?",
      nextQuestion: null,
      recommendation: null,
      events: [],
      outcome: null,
    });
    mocks.telemetry.mockReturnValue({
      providerCalled: true,
      providerSucceeded: true,
      providerErrorType: null,
      interpretationSource: "LLM",
      dialogueAct: "FITTING_REQUEST",
      interpretationConfidence: 0.9,
      declaredFacts: [
        { key: "handicapIndex", canonicalValue: 12, status: "KNOWN" },
      ],
      playerFactsBefore: { handicapIndex: 12 },
      playerFactsAfter: { handicapIndex: 12 },
      miGolfLoaded: true,
      recipientContext: "SELF",
    });
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await POST(request("{"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "INVALID_JSON" });
    expect(mocks.process).not.toHaveBeenCalled();
  });

  it("returns 413 before reading a body whose declared size is over the cap", async () => {
    const response = await POST(
      request("{}", { "content-length": String(96 * 1024 + 1) }),
    );
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "REQUEST_TOO_LARGE" });
    expect(mocks.process).not.toHaveBeenCalled();
  });

  it("returns 413 when a streamed request exceeds the cap without Content-Length", async () => {
    const bytes = new TextEncoder().encode(" ".repeat(96 * 1024 + 1));
    const streamed = new Request("http://localhost/api/best-round-pro", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      }),
      // @ts-expect-error Node's Request requires duplex for a streamed body.
      duplex: "half",
    });
    const response = await POST(streamed);
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "REQUEST_TOO_LARGE" });
    expect(mocks.process).not.toHaveBeenCalled();
  });

  it("rejects more than 24 diagnostic answers", async () => {
    const state = initialConversationState();
    state.session.diagnosticAnswers = Object.fromEntries(
      Array.from({ length: 25 }, (_, index) => [`fact${index}`, index]),
    );
    const response = await POST(
      request(JSON.stringify({ message: "Quiero un driver", state })),
    );
    expect(response.status).toBe(400);
    expect(mocks.process).not.toHaveBeenCalled();
  });

  it("rejects an overlong diagnostic value", async () => {
    const state = initialConversationState();
    state.session.diagnosticAnswers = { objective: "x".repeat(121) };
    const response = await POST(
      request(JSON.stringify({ message: "Quiero un driver", state })),
    );
    expect(response.status).toBe(400);
    expect(mocks.process).not.toHaveBeenCalled();
  });

  it("does not return raw player facts or values in client telemetry", async () => {
    const response = await POST(request(JSON.stringify({ message: "Hola" })));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.telemetry).toMatchObject({
      providerUsed: true,
      providerStatus: "SUCCEEDED",
      interpretationSource: "LLM",
      dialogueAct: "FITTING_REQUEST",
      outcome: null,
      recommendationCount: 0,
    });
    expect(JSON.stringify(payload.telemetry)).not.toContain("handicapIndex");
    expect(JSON.stringify(payload.telemetry)).not.toContain("handicap");
    expect(payload.telemetry.playerFactsBefore).toBeUndefined();
  });
});
