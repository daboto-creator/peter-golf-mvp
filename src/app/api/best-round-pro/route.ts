import { NextResponse } from "next/server";
import { z } from "zod";

import { initialConversationState } from "@/lib/best-round-pro/conversation";
import { getLastInterpreterTelemetry, processConversationTurn } from "@/lib/best-round-pro/service";

const requestSchema = z.object({
  message: z.string().trim().min(1).max(800),
  currentPageProduct: z.object({
    id: z.string(), slug: z.string(), name: z.string(), category: z.string().nullable(),
    condition: z.string(), price: z.number(), productHref: z.string(), imagePath: z.string().nullable(),
    handedness: z.string().nullable().optional().default(null), family: z.string().nullable().optional().default(null),
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
    })
    .default(initialConversationState()),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const result = await processConversationTurn(body);
    const telemetry = getLastInterpreterTelemetry();
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
      semanticStateChanged: telemetry.semanticStateChanged,
      playerFactsChanged: telemetry.playerFactsChanged,
      pendingQuestionChanged: telemetry.pendingQuestionChanged,
      productFamily: result.state.session.requestedCategory,
      pendingBefore: body.state.pendingQuestionKey,
      pendingAfter: result.state.pendingQuestionKey,
      stateChanged: JSON.stringify(body.state.session) !== JSON.stringify(result.state.session),
      nextQuestionKey: result.nextQuestion?.id ?? result.state.pendingQuestionKey,
      plannedAction: result.recommendation ? "RUN_RECOMMENDATION" : result.nextQuestion ? "ASK_NEXT_QUESTION" : "RETURN_TERMINAL_OUTCOME",
      executedAction: result.recommendation ? "RUN_RECOMMENDATION" : result.nextQuestion ? "ASK_NEXT_QUESTION" : "RETURN_TERMINAL_OUTCOME",
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
        inputTokens: 0,
        outputTokens: 0,
        researchCalls: 0,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
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
