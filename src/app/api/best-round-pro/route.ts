import { NextResponse } from "next/server";
import { z } from "zod";

import { initialConversationState } from "@/lib/best-round-pro/conversation";
import { processConversationTurn } from "@/lib/best-round-pro/service";

const requestSchema = z.object({
  message: z.string().trim().min(1).max(800),
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
    })
    .default(initialConversationState()),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const result = await processConversationTurn(body);
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
        model: "deterministic-rules-v1",
        inputTokens: 0,
        outputTokens: 0,
        researchCalls: 0,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    return NextResponse.json(
      { error: "CONVERSATION_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
