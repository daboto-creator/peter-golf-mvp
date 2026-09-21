import { NextResponse } from "next/server";
import { z } from "zod";

import { initialConversationState, type ConversationProductContext } from "@/lib/best-round-pro/conversation";
import { getLastInterpreterTelemetry, processConversationTurn } from "@/lib/best-round-pro/service";

const requestSchema = z.object({
  message: z.string().trim().min(1).max(800),
  currentPageProduct: z.object({
    id: z.string(), slug: z.string(), name: z.string(), productFamily: z.string().nullable(),
  }).nullable().optional().default(null),
  state: z
    .object({
      session: z.object({
        requestedCategory: z.string().nullable(),
        purchaseIntent: z.enum([
          "BUY_NOW",
          "ACTIVE_RESEARCH",
          "EXPLORING",
          "UNKNOWN",
        ]),
        budgetMxnMinor: z.number().nullable(),
        objections: z.array(z.string()).max(10),
        productsConsidered: z.array(z.string()).max(20),
        diagnosticAnswers: z
          .record(
            z.string(),
            z.union([z.string(), z.number(), z.boolean(), z.null()]),
          )
          .default({}),
        unresolvedQuestions: z.array(z.string()).max(10),
        summary: z.string().nullable(),
      }),
      messages: z
        .array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string().max(1200),
          }),
        )
        .max(30),
      discussedProductIds: z.array(z.string()).max(20),
      pendingQuestionKey: z.string().nullable().default(null),
      pendingQuestionCategory: z.string().nullable().default(null),
      pendingQuestionSlotType: z
        .enum([
          "CATEGORY",
          "HANDEDNESS",
          "HANDICAP",
          "SWING_SPEED",
          "SHOT_TENDENCY",
          "DISTANCE_GAP",
          "CURRENT_EQUIPMENT",
          "CONDITION_PREFERENCE",
          "OBJECTIVE",
          "PUTTER_LENGTH",
          "WEDGE_CONTEXT",
          "BOOLEAN_PREFERENCE",
        ])
        .nullable()
        .default(null),
      lastCatalogResults: z.array(z.object({
        id: z.string(), slug: z.string(), name: z.string(), category: z.string().nullable(),
        condition: z.string(), price: z.number(), productHref: z.string(), imagePath: z.string().nullable(),
        handedness: z.string().nullable().optional().default(null), family: z.string().nullable().optional().default(null),
      })).max(20).default([]),
      lastFocusedProduct: z.object({
        id: z.string(), slug: z.string(), name: z.string(), category: z.string().nullable(),
        condition: z.string(), price: z.number(), productHref: z.string(), imagePath: z.string().nullable(),
        handedness: z.string().nullable().optional().default(null), family: z.string().nullable().optional().default(null),
      }).nullable().default(null),
      lastInteractedProduct: z.object({
        id: z.string(), slug: z.string(), name: z.string(), category: z.string().nullable(),
        condition: z.string(), price: z.number(), productHref: z.string(), imagePath: z.string().nullable(),
        handedness: z.string().nullable().optional().default(null), family: z.string().nullable().optional().default(null),
      }).nullable().default(null),
      focusedProductSource: z.enum(["CURRENT_PAGE", "PRODUCT_CARD_CLICK", "EXPLICIT_NAME", "UNIQUE_RECENT_RESULT", "RECOMMENDATION"]).nullable().default(null),
      referenceResolution: z.object({
        productId: z.string().nullable(),
        source: z.enum(["CURRENT_PAGE", "PRODUCT_CARD_CLICK", "FOCUSED_CONTEXT", "EXPLICIT_NAME", "UNIQUE_RECENT_RESULT", "CLARIFICATION_REQUIRED"]),
      }).optional().default({ productId: null, source: "CLARIFICATION_REQUIRED" }),
      productAdvice: z.object({
        active: z.boolean(),
        product: z.object({
          id: z.string(), slug: z.string(), name: z.string(), category: z.string().nullable(),
          condition: z.string(), price: z.number(), productHref: z.string(), imagePath: z.string().nullable(),
          handedness: z.string().nullable().optional().default(null), family: z.string().nullable().optional().default(null),
        }).nullable(),
        pendingQuestionKey: z.string().nullable(),
        collectedAnswers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
      }).optional().default({ active: false, product: null, pendingQuestionKey: null, collectedAnswers: {} }),
      participants: z.object({
        buyer: z.object({ isLoggedInUser: z.literal(true) }),
        player: z.object({
          relationToBuyer: z.enum(["SELF", "SPOUSE", "CHILD", "FRIEND", "OTHER", "UNKNOWN"]),
          displayReference: z.string(),
          facts: z.record(z.string(), z.object({ status: z.enum(["KNOWN", "UNKNOWN", "NONE", "NOT_APPLICABLE", "DECLINED"]), value: z.unknown().optional(), confidence: z.number(), source: z.enum(["USER", "INFERRED"]) })),
        }),
      }).optional().default({ buyer: { isLoggedInUser: true }, player: { relationToBuyer: "SELF", displayReference: "tú", facts: {} } }),
      pendingAssistantOffer: z.object({
        action: z.enum(["START_PRODUCT_ADVICE", "COMPARE_PRODUCTS", "SHOW_ALTERNATIVES", "CONTINUE_RECOMMENDATION"]),
        targetProductIds: z.array(z.string()),
        createdAtTurn: z.number(),
      }).nullable().optional().default(null),
      conversationLoop: z.object({
        lastQuestionKey: z.string().nullable(),
        consecutiveSameQuestionCount: z.number().int().nonnegative(),
        lastSemanticFingerprint: z.string().nullable(),
      }).optional().default({ lastQuestionKey: null, consecutiveSameQuestionCount: 0, lastSemanticFingerprint: null }),
      searchScope: z.object({
        families: z.array(z.enum(["DRIVER", "FAIRWAY_WOOD", "HYBRID", "IRON", "WEDGE", "PUTTER", "SET"])),
        mode: z.enum(["EXACT", "MULTI_FAMILY", "ALL_CLUBS", "ALL_EQUIPMENT"]),
        source: z.enum(["EXPLICIT_CURRENT_TURN", "INHERITED_CONTEXT"]),
      }).nullable().optional().default(null),
      catalogSearchOutcome: z.enum(["RESULTS_FOUND", "NO_COMPATIBLE_INVENTORY", "NO_INVENTORY"]).nullable().optional().default(null),
      compatibilityOutcome: z.enum(["MATCH", "HARD_INCOMPATIBLE", "UNKNOWN"]).nullable().optional().default(null),
      /** Legacy client field; it is read only as a catalog-search outcome and never accepts HARD_INCOMPATIBLE. */
      searchOutcome: z.enum(["RESULTS_FOUND", "NO_COMPATIBLE_INVENTORY", "NO_INVENTORY"]).nullable().optional(),
      lastExecutedAction: z.string().nullable().optional().default(null),
      searchContinuation: z.object({
        relation: z.enum(["KEEP_SCOPE", "BROADEN_SCOPE", "REPLACE_SCOPE"]),
        reason: z.enum(["EXPLICIT_CURRENT_TURN", "ELLIPTICAL_CONTINUATION", "PREVIOUS_SCOPE_EXHAUSTED"]),
      }).nullable().optional().default(null),
    })
    .default(initialConversationState()),
});

export async function POST(request: Request) {
  let rawRequestBody: unknown = null;
  try {
    rawRequestBody = await request.json();
    const parsedBody = requestSchema.parse(rawRequestBody) as z.infer<typeof requestSchema> & { currentPageProduct: ConversationProductContext | null };
    const body = {
      ...parsedBody,
      state: {
        ...parsedBody.state,
        catalogSearchOutcome: parsedBody.state.catalogSearchOutcome ?? parsedBody.state.searchOutcome ?? null,
      },
    };
    const result = await processConversationTurn(body);
    const telemetry = getLastInterpreterTelemetry();
    const plannedAction = telemetry.dialogueAct === "ASK_PRODUCT_FIT"
      ? "ASK_PRODUCT_FIT"
      : telemetry.dialogueAct === "ASK_PRODUCT_REASON"
        ? "EXPLAIN_PRODUCT_REASON"
        : telemetry.dialogueAct === "CONFIRMATION"
          ? "START_PRODUCT_ADVICE"
          : telemetry.dialogueAct === "PRODUCT_ADVICE" || telemetry.dialogueAct === "FITTING_REQUEST"
            ? "START_PRODUCT_ADVICE"
            : telemetry.dialogueAct === "CATALOG_SEARCH"
              ? "SEARCH_CATALOG"
              : telemetry.dialogueAct ?? "ROUTE_FALLBACK";
    const executedAction = result.events.includes("PRODUCT_REFERENCE_CLARIFICATION")
      ? "CLARIFY_PRODUCT_REFERENCE"
      : result.events.some((event) => event.includes("HARD_INCOMPATIBILITY"))
        ? "RETURN_HARD_INCOMPATIBILITY"
        : result.events.includes("COMMERCIAL_CATALOG_SEARCH")
          ? (("catalogProducts" in result && (result.catalogProducts?.length ?? 0) > 0) ? "SHOW_CATALOG_RESULTS" : "RETURN_NO_COMPATIBLE_INVENTORY")
          : result.state.lastExecutedAction ?? (result.nextQuestion || result.state.pendingQuestionKey
            ? "ASK_NEXT_QUESTION"
            : result.recommendation
              ? "RUN_RECOMMENDATION"
              : result.events.some((event) => event.startsWith("SOCIAL_"))
                ? "ANSWER_SOCIAL"
                : "RETURN_TERMINAL_OUTCOME");
    console.info("best_round_pro_turn_trace", {
      providerSucceeded: telemetry.providerSucceeded,
      providerCalled: telemetry.providerCalled,
      providerHttpStatus: telemetry.providerHttpStatus ?? null,
      providerTimedOut: telemetry.providerTimedOut ?? false,
      providerErrorType: telemetry.providerErrorType,
      providerJsonParsed: telemetry.jsonParsed ?? null,
      providerValidationSucceeded: telemetry.providerSucceeded && (telemetry.validationIssues?.length ?? 0) === 0,
      providerValidationIssues: telemetry.validationIssues ?? [],
      interpretationSource: telemetry.interpretationSource,
      dialogueAct: telemetry.dialogueAct ?? null,
      dialogueActRaw: telemetry.dialogueAct ?? null,
      answersPendingQuestion: telemetry.answersPendingQuestion ?? false,
      declaredFactKeys: telemetry.declaredFactKeys ?? [],
      declaredFactStatuses: telemetry.declaredFactStatuses ?? [],
      declaredFacts: telemetry.declaredFacts ?? [],
      rawHandednessStatus: telemetry.declaredFactKeys?.includes("handedness")
        ? telemetry.declaredFactStatuses?.[telemetry.declaredFactKeys.indexOf("handedness")] ?? null
        : null,
      canonicalHandedness: telemetry.declaredFacts?.find((fact) => fact.key === "handedness")?.canonicalValue ?? null,
      playerHandednessAfter: result.state.session.diagnosticAnswers.handedness ?? null,
      semanticStateChanged: telemetry.semanticStateChanged,
      playerFactsChanged: telemetry.playerFactsChanged,
      pendingQuestionChanged: telemetry.pendingQuestionChanged,
      productFamily: result.state.session.requestedCategory,
      focusedProductFamily: result.state.lastFocusedProduct?.family ?? result.state.productAdvice.product?.family ?? null,
      focusedProductId: result.state.lastFocusedProduct?.id ?? result.state.productAdvice.product?.id ?? null,
      focusedProductSource: result.state.focusedProductSource ?? null,
      lastInteractedProductId: result.state.lastInteractedProduct?.id ?? null,
      currentPageProductId: body.currentPageProduct?.id ?? null,
      recentResultIds: result.state.lastCatalogResults.map((product) => product.id),
      resolvedReferenceProductId: result.state.referenceResolution.productId,
      referenceResolutionSource: result.state.referenceResolution.source,
      previousSearchFamilies: body.state.searchScope?.families ?? [],
      interpretedRequestedFamilies: telemetry.requestedProductFamilies ?? [],
      previousSearchOutcome: body.state.catalogSearchOutcome ?? null,
      lastExecutedAction: result.state.lastExecutedAction,
      activeSearchFamilies: result.state.searchScope?.families ?? [],
      searchScopeMode: result.state.searchScope?.mode ?? null,
      searchScopeSource: result.state.searchScope?.source ?? null,
      searchContinuationRelation: telemetry.searchContinuationRelation ?? result.state.searchContinuation?.relation ?? null,
      searchContinuationReason: telemetry.searchContinuationReason ?? result.state.searchContinuation?.reason ?? null,
      catalogScopeIntent: telemetry.catalogScopeIntent ?? null,
      playerHandedness: result.state.session.diagnosticAnswers.handedness ?? null,
      compatibilityOutcome: result.state.compatibilityOutcome ?? null,
      catalogSearchOutcome: result.state.catalogSearchOutcome ?? null,
      pendingBefore: body.state.pendingQuestionKey,
      pendingAfter: result.state.pendingQuestionKey,
      stateChanged: JSON.stringify(body.state.session) !== JSON.stringify(result.state.session),
      nextQuestionKey: result.nextQuestion?.id ?? result.state.pendingQuestionKey,
      plannedAction,
      executedAction,
      stallDetected: (result.state.conversationLoop?.consecutiveSameQuestionCount ?? 0) >= 2,
    });
    return NextResponse.json({
      state: result.state,
      reply: result.reply,
      nextQuestion: result.nextQuestion,
      recommendation: result.recommendation,
      catalogProducts: "catalogProducts" in result ? result.catalogProducts : null,
      intent: "intent" in result ? result.intent : null,
      outcome: result.outcome ?? null,
      error: "error" in result ? result.error : null,
      telemetry: {
        ...telemetry,
        recentResultIds: result.state.lastCatalogResults.map((product) => product.id),
        lastInteractedProductId: result.state.lastInteractedProduct?.id ?? null,
        focusedProductId: result.state.lastFocusedProduct?.id ?? result.state.productAdvice.product?.id ?? null,
        focusedProductSource: result.state.focusedProductSource ?? null,
        currentPageProductId: body.currentPageProduct?.id ?? null,
        resolvedReferenceProductId: result.state.referenceResolution.productId,
        referenceResolutionSource: result.state.referenceResolution.source,
        plannedAction,
        executedAction,
        inputTokens: 0,
        outputTokens: 0,
        researchCalls: 0,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.info("best_round_pro_request_validation_error", {
        issuePaths: error.issues.map((issue) => issue.path.join(".")),
        issueCodes: error.issues.map((issue) => issue.code),
        expectedTypes: error.issues.map((issue) => "expected" in issue ? String(issue.expected) : null),
        receivedTypes: error.issues.map((issue) => "received" in issue ? typeof issue.received : null),
        hasCurrentPageProduct: Boolean(rawRequestBody && typeof rawRequestBody === "object" && "currentPageProduct" in rawRequestBody && (rawRequestBody as { currentPageProduct?: unknown }).currentPageProduct),
      });
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }
    console.error("best_round_pro_runtime_error", {
      stage: "SERIALIZE_RESPONSE",
      errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
      provider: getLastInterpreterTelemetry(),
    });
    return NextResponse.json(
      { error: "CONVERSATION_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
