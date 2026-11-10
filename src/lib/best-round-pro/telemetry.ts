type TelemetrySource = Record<string, unknown>;

export function safeBestRoundTelemetry(input: {
  source: TelemetrySource;
  durationMs: number;
  recommendationCount: number;
  confidence: string | null;
  outcome: string | null;
}) {
  const source = input.source;
  return {
    providerCalled: source.providerCalled === true,
    providerSucceeded: source.providerSucceeded === true,
    providerErrorType:
      typeof source.providerErrorType === "string"
        ? source.providerErrorType
        : null,
    providerModel:
      typeof source.providerModel === "string" ? source.providerModel : null,
    providerHttpStatus:
      typeof source.providerHttpStatus === "number"
        ? source.providerHttpStatus
        : null,
    providerTimedOut: source.providerTimedOut === true,
    interpretationSource:
      source.interpretationSource === "LLM" ? "LLM" : "FALLBACK",
    dialogueAct:
      typeof source.effectiveDialogueAct === "string"
        ? source.effectiveDialogueAct
        : typeof source.dialogueAct === "string"
          ? source.dialogueAct
          : null,
    providerValidationIssueCount: Array.isArray(source.validationIssues)
      ? source.validationIssues.length
      : 0,
    recommendationCount: input.recommendationCount,
    confidence: input.confidence,
    outcome: input.outcome,
    miGolfLoaded: source.miGolfLoaded === true,
    recipientContext:
      source.recipientContext === "SELF" ||
      source.recipientContext === "THIRD_PARTY"
        ? source.recipientContext
        : "UNKNOWN",
    explanationGrounded: source.explanationGrounded === true,
    groundingIssueCount: Array.isArray(source.groundingIssues)
      ? source.groundingIssues.length
      : 0,
    explanationLatencyMs:
      typeof source.explanationLatencyMs === "number"
        ? source.explanationLatencyMs
        : null,
    lowConfidenceDisclosed: source.lowConfidenceDisclosed === true,
    durationMs: Math.max(0, Math.trunc(input.durationMs)),
  };
}

export function clientBestRoundTelemetry(
  input: ReturnType<typeof safeBestRoundTelemetry>,
) {
  return {
    providerUsed: input.providerCalled,
    providerStatus: input.providerCalled
      ? input.providerSucceeded
        ? "SUCCEEDED"
        : "FALLBACK"
      : "UNAVAILABLE",
    interpretationSource: input.interpretationSource,
    dialogueAct: input.dialogueAct,
    explanationGrounded: input.explanationGrounded,
    groundingIssueCount: input.groundingIssueCount,
    outcome: input.outcome,
    recommendationCount: input.recommendationCount,
    confidence: input.confidence,
    lowConfidenceDisclosed: input.lowConfidenceDisclosed,
  };
}
