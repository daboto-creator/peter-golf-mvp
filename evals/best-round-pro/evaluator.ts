import { detectGolfCategory } from "@/lib/best-round-pro/category-normalization";
import { routeConversationIntent } from "@/lib/best-round-pro/intent-router";
import { resolveRecipientContext } from "@/lib/mi-golf/domain";
import type { BrpScenario } from "./scenarios";

export function evaluateCorpus(scenarios: BrpScenario[]) {
  const fallbackRouteCounts = Object.fromEntries(
    [
      ...new Set(
        scenarios.map((scenario) =>
          routeConversationIntent(scenario.userMessages.at(-1) ?? ""),
        ),
      ),
    ].map((route) => [
      route,
      scenarios.filter(
        (scenario) =>
          routeConversationIntent(scenario.userMessages.at(-1) ?? "") === route,
      ).length,
    ]),
  );
  const categoryMeasured = scenarios.filter(
    (scenario) => scenario.expectedProductCategory !== null,
  );
  const categoryMismatches = categoryMeasured.flatMap((scenario) => {
    const message = scenario.userMessages.at(-1) ?? "";
    const actual =
      detectGolfCategory(message) ?? scenario.initialContext.requestedCategory;
    return actual === scenario.expectedProductCategory
      ? []
      : [
          {
            id: scenario.id,
            expected: scenario.expectedProductCategory,
            actual,
          },
        ];
  });
  const categoryCorrect = categoryMeasured.length - categoryMismatches.length;
  const recipientMeasured = scenarios.filter(
    (scenario) => scenario.expectedRecipient !== "UNKNOWN",
  );
  const recipientMismatches = recipientMeasured.flatMap((scenario) => {
    const actual = resolveRecipientContext(
      scenario.userMessages.at(-1) ?? "",
      scenario.initialContext.recipient,
    );
    return actual === scenario.expectedRecipient
      ? []
      : [{ id: scenario.id, expected: scenario.expectedRecipient, actual }];
  });
  const recipientCorrect =
    recipientMeasured.length - recipientMismatches.length;
  return {
    scenarioCount: scenarios.length,
    categoryCounts: Object.fromEntries(
      [...new Set(scenarios.map((scenario) => scenario.category))].map(
        (category) => [
          category,
          scenarios.filter((scenario) => scenario.category === category).length,
        ],
      ),
    ),
    intentAccuracy: null,
    intentCorrect: null,
    intentMeasured: 0,
    intentMismatches: [],
    fallbackRouteCounts,
    categoryAccuracy: categoryMeasured.length
      ? categoryCorrect / categoryMeasured.length
      : null,
    categoryCorrect,
    categoryMeasured: categoryMeasured.length,
    categoryMismatches,
    recipientAccuracy: recipientMeasured.length
      ? recipientCorrect / recipientMeasured.length
      : null,
    recipientCorrect,
    recipientMeasured: recipientMeasured.length,
    recipientMismatches,
    providerScenarios: scenarios.filter((scenario) => scenario.providerEval),
    notMeasured: [
      "fact extraction and pending-answer accuracy (requires stateful turn execution)",
      "recommendation technical validity / inventory truth (covered by matching and catalog tests, not conversation corpus)",
      "unsupported claim rate (measured separately on provider evaluation outputs)",
      "question repetition, loop/stall and completion rates (requires stateful turn sequence evaluation)",
      "subjective naturalness and explanation quality (human review)",
    ],
  };
}
