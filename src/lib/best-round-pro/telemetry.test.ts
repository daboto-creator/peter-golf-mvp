import { describe, expect, it } from "vitest";

import { clientBestRoundTelemetry, safeBestRoundTelemetry } from "./telemetry";

describe("Best Round Pro telemetry privacy", () => {
  it("keeps operational signals while removing raw facts, text, and ids", () => {
    const safe = safeBestRoundTelemetry({
      source: {
        providerCalled: true,
        providerSucceeded: true,
        dialogueAct: "PRODUCT_ADVICE",
        miGolfLoaded: true,
        playerFactsAfter: { handicapIndex: 12, handedness: "LEFT" },
        declaredFacts: [{ key: "handicapIndex", canonicalValue: 12 }],
        rawUserMessage: "Mi handicap es 12",
        currentProductId: "private-id",
        providerModel: "model-name-internal-only",
      },
      durationMs: 123,
      recommendationCount: 1,
      confidence: "MEDIUM",
      outcome: "RECOMMENDATIONS_AVAILABLE",
    });
    expect(safe).toMatchObject({
      providerCalled: true,
      dialogueAct: "PRODUCT_ADVICE",
      durationMs: 123,
    });
    expect(JSON.stringify(safe)).not.toMatch(
      /handicapIndex|LEFT|private-id|Mi handicap/,
    );
    expect(JSON.stringify(clientBestRoundTelemetry(safe))).not.toMatch(
      /handicapIndex|private-id/,
    );
    expect(JSON.stringify(clientBestRoundTelemetry(safe))).not.toContain(
      "model-name-internal-only",
    );
  });
});
