import { describe, expect, it } from "vitest";

import { initialConversationState } from "./conversation";
import { bestRoundProScenarios } from "../../../evals/best-round-pro/scenarios";

const previewBaseUrl = process.env.BRP_PROVIDER_EVAL_BASE_URL?.replace(
  /\/$/,
  "",
);
const providerCases = bestRoundProScenarios.filter(
  (scenario) => scenario.providerEval,
);

describe.skipIf(!previewBaseUrl)(
  "Best Round Pro real-provider evaluation (explicit Preview URL only)",
  () => {
    it("evaluates the curated provider subset without retaining response text", async () => {
      const previewUrl = new URL(previewBaseUrl!);
      expect(previewUrl.protocol).toBe("https:");
      expect(previewUrl.hostname.endsWith(".vercel.app")).toBe(true);
      expect(providerCases).toHaveLength(21);

      const outcomes: Array<{
        id: string;
        dialogueAct: string | null;
        expected: string[];
        providerStatus: string;
        grounded: boolean | null;
        unsupportedClaim: boolean;
        recipient: string | null;
        expectedRecipient: string;
        lowConfidenceRecommendation: boolean;
        lowConfidenceDisclosed: boolean;
        latencyMs: number;
      }> = [];

      for (const scenario of providerCases) {
        let state = initialConversationState();
        state.session.requestedCategory =
          scenario.initialContext.requestedCategory;
        state.pendingQuestionKey = scenario.initialContext.pendingQuestionKey;
        if (scenario.initialContext.focusedProduct) {
          state.lastFocusedProduct = {
            id: `eval-${scenario.id}`,
            slug: `eval-${scenario.id}`,
            name: scenario.initialContext.focusedProduct,
            category: scenario.initialContext.requestedCategory,
            condition: "new",
            price: 100000,
            productHref: `/productos/eval-${scenario.id}`,
            imagePath: null,
            handedness: "RIGHT",
            family: scenario.initialContext.requestedCategory,
            targetPlayerLevel: "UNKNOWN",
          };
          state.focusedProductSource = "RECOMMENDATION";
        }

        let finalPayload: Record<string, unknown> = {};
        const startedAt = Date.now();
        for (const message of scenario.userMessages) {
          const response = await fetch(`${previewBaseUrl}/api/best-round-pro`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ message, state }),
          });
          expect(response.status, scenario.id).toBe(200);
          finalPayload = (await response.json()) as Record<string, unknown>;
          expect(typeof finalPayload.reply, scenario.id).toBe("string");
          expect(
            String(finalPayload.reply).trim().length,
            scenario.id,
          ).toBeGreaterThan(0);
          state = finalPayload.state as typeof state;
        }

        const telemetry = finalPayload.telemetry as Record<string, unknown>;
        const resultState = finalPayload.state as {
          participants?: { player?: { relationToBuyer?: string } };
        };
        const recommendation = finalPayload.recommendation as {
          recommendations?: Array<{ equipmentMatch?: { confidence?: string } }>;
        } | null;
        const lowConfidenceRecommendation =
          recommendation?.recommendations?.[0]?.equipmentMatch?.confidence ===
          "LOW";
        const reply = String(finalPayload.reply);
        const unsupportedClaim =
          /\b(?:te dara mas distancia|ganaras distancia|mas perdonador|perdona mas|menos spin|lanzamiento mas alto|mejor feel)\b/i.test(
            reply.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
          );
        outcomes.push({
          id: scenario.id,
          dialogueAct:
            typeof telemetry?.dialogueAct === "string"
              ? telemetry.dialogueAct
              : null,
          expected: scenario.expectedDialogueActs ?? [],
          providerStatus:
            typeof telemetry?.providerStatus === "string"
              ? telemetry.providerStatus
              : "MISSING",
          grounded:
            typeof telemetry?.explanationGrounded === "boolean"
              ? telemetry.explanationGrounded
              : null,
          unsupportedClaim,
          recipient: resultState.participants?.player?.relationToBuyer ?? null,
          expectedRecipient: scenario.expectedRecipient,
          lowConfidenceRecommendation,
          lowConfidenceDisclosed:
            telemetry?.lowConfidenceDisclosed === true &&
            /provisional/i.test(reply),
          latencyMs: Date.now() - startedAt,
        });
      }

      const intentMeasured = outcomes.filter(
        (outcome) => outcome.expected.length > 0,
      );
      const intentCorrect = intentMeasured.filter((outcome) =>
        outcome.expected.includes(outcome.dialogueAct ?? ""),
      ).length;
      const providerSucceeded = outcomes.filter(
        (outcome) => outcome.providerStatus === "SUCCEEDED",
      ).length;
      const unsupportedClaimCount = outcomes.filter(
        (outcome) => outcome.unsupportedClaim,
      ).length;
      const recipientMeasured = outcomes.filter(
        (outcome) => outcome.expectedRecipient !== "UNKNOWN",
      );
      const recipientCorrect = recipientMeasured.filter(
        (outcome) => outcome.recipient === outcome.expectedRecipient,
      ).length;
      const lowConfidenceCases = outcomes.filter(
        (outcome) => outcome.lowConfidenceRecommendation,
      );
      const latencies = outcomes
        .map((outcome) => outcome.latencyMs)
        .sort((a, b) => a - b);
      console.info("best_round_pro_provider_eval", {
        timestamp: new Date().toISOString(),
        model: "read providerModel from the matching deployment server trace",
        scenarioCount: outcomes.length,
        intentAccuracy: intentMeasured.length
          ? intentCorrect / intentMeasured.length
          : null,
        intentCorrect,
        intentMeasured: intentMeasured.length,
        recipientAccuracy: recipientMeasured.length
          ? recipientCorrect / recipientMeasured.length
          : null,
        recipientCorrect,
        recipientMeasured: recipientMeasured.length,
        providerSucceeded,
        unsupportedClaimCount,
        groundedExplanations: outcomes.filter(
          (outcome) => outcome.grounded === true,
        ).length,
        fallbackExplanations: outcomes.filter(
          (outcome) => outcome.grounded === false,
        ).length,
        lowConfidenceDisclosed: lowConfidenceCases.filter(
          (outcome) => outcome.lowConfidenceDisclosed,
        ).length,
        lowConfidenceMeasured: lowConfidenceCases.length,
        medianEndToEndLatencyMs:
          latencies[Math.floor(latencies.length / 2)] ?? null,
        p95EndToEndLatencyMs:
          latencies[Math.ceil(latencies.length * 0.95) - 1] ?? null,
        outcomes,
      });
      expect(providerSucceeded).toBeGreaterThan(0);
      expect(unsupportedClaimCount).toBe(0);
      expect(intentMeasured.length).toBe(providerCases.length);
      expect(intentCorrect / intentMeasured.length).toBeGreaterThanOrEqual(0.9);
      expect(recipientCorrect / recipientMeasured.length).toBe(1);
    }, 180_000);
  },
);
