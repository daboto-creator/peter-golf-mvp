import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  interpretation: vi.fn(),
  currentPageProduct: null as Record<string, unknown> | null,
  catalogProducts: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/auth/user", () => ({ getAuthenticatedUser: vi.fn(async () => null) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/best-round-pro/provider", () => ({
  getConversationProvider: () => ({
    interpretTurn: mocks.interpretation,
    explainRecommendation: vi.fn(async () => ""),
  }),
  safeRecommendationPayload: vi.fn(() => null),
}));
vi.mock("@/lib/catalog/public-products", () => ({
  getPublicProductBySlug: vi.fn(async () => ({ data: mocks.currentPageProduct, error: false })),
  listPublicProducts: vi.fn(async () => ({ data: mocks.catalogProducts, error: false })),
}));
vi.mock("@/lib/best-round-pro/catalog-search", () => ({
  searchCommercialCatalog: vi.fn(async () => ({ products: mocks.catalogProducts, error: false, message: "Resultados" })),
  searchCatalogScope: vi.fn(async () => ({ products: mocks.catalogProducts, error: false })),
}));
vi.mock("@/lib/recommendations/inventory-candidates", () => ({
  loadInventoryUnits: vi.fn(async () => ({ data: [], error: false })),
}));

import {
  initialConversationState,
  type CatalogProductReference,
  type ConversationState,
} from "./conversation";
import { processConversationTurn } from "./service";

const product = (id: string, handedness: "LEFT" | "RIGHT" = "LEFT"): CatalogProductReference => ({
  id,
  slug: id.toLowerCase(),
  name: `Product ${id}`,
  category: "Driver",
  condition: "new",
  price: 10000,
  productHref: `/productos/${id.toLowerCase()}`,
  imagePath: null,
  handedness,
  family: "club",
});

const publicProduct = (reference: CatalogProductReference) => ({
  ...reference,
  categoryName: reference.category,
  productFamily: reference.family,
  images: [],
  setSpecs: null,
});

function interpretation(
  dialogueAct: string,
  options: { reasonMode?: "CATALOG_REASON" | "PERSONAL_FIT_REASON"; catalog?: boolean; asksWhat?: boolean } = {},
) {
  return {
    dialogueAct,
    intent: "ACTIVE_RESEARCH",
    category: null,
    requestedProductFamilies: options.catalog ? ["DRIVER"] : [],
    searchScopeMode: options.catalog ? "EXACT" : null,
    catalogScopeIntent: options.catalog ? "EXPLICIT_FAMILIES" : null,
    searchContinuationRelation: null,
    searchContinuationReason: null,
    productReference: null,
    reasonMode: options.reasonMode ?? null,
    declaredFacts: [],
    temporaryPreferences: [],
    objection: null,
    wantsRecommendation: false,
    wantsHandoff: false,
    answersPendingQuestion: false,
    asksForExplanation: dialogueAct === "ASK_PRODUCT_REASON",
    asksWhatInformationNeeded: options.asksWhat ?? false,
    topicChanged: false,
    confidence: 1,
    entities: { purchaseTarget: "SELF", relationship: "UNKNOWN", playerReference: null },
  };
}

function knownLeftState(): ConversationState {
  const state = initialConversationState();
  state.session.diagnosticAnswers.handedness = "LEFT";
  return state;
}

describe("Best Round Pro source-gap regressions", () => {
  beforeEach(() => {
    mocks.currentPageProduct = null;
    mocks.catalogProducts = [];
    mocks.interpretation.mockReset();
  });

  it("invalidates stale focus after a new multi-result catalog search", async () => {
    const state = knownLeftState();
    state.lastFocusedProduct = product("X");
    state.focusedProductSource = "RECOMMENDATION";
    mocks.catalogProducts = [product("A"), product("B"), product("C")].map(publicProduct);
    mocks.interpretation.mockResolvedValueOnce(interpretation("CATALOG_SEARCH", { catalog: true }));

    const search = await processConversationTurn({ state, message: "muéstrame drivers" });
    expect(search.state.lastFocusedProduct).toBeNull();
    expect(search.state.referenceResolution.source).toBe("CLARIFICATION_REQUIRED");

    mocks.interpretation.mockResolvedValueOnce(interpretation("ASK_PRODUCT_FIT"));
    const followUp = await processConversationTurn({ state: search.state, message: "este me sirve?" });
    expect(followUp.events).toContain("PRODUCT_REFERENCE_CLARIFICATION");
    expect(followUp.state.referenceResolution.source).toBe("CLARIFICATION_REQUIRED");
  });

  it("resolves a unique current result without rerunning catalog search", async () => {
    const state = knownLeftState();
    state.lastCatalogResults = [product("A")];
    mocks.interpretation.mockResolvedValueOnce(interpretation("ASK_PRODUCT_FIT"));

    const result = await processConversationTurn({ state, message: "este me sirve?" });
    expect(result.state.referenceResolution).toEqual({ productId: "A", source: "UNIQUE_RECENT_RESULT" });
    expect(result.events).not.toContain("COMMERCIAL_CATALOG_SEARCH");
  });

  it("uses current page ahead of a different click and old focus", async () => {
    const state = knownLeftState();
    state.lastCatalogResults = [product("A"), product("B"), product("C")];
    state.lastInteractedProduct = product("B");
    state.lastFocusedProduct = product("C");
    state.focusedProductSource = "PRODUCT_CARD_CLICK";
    mocks.currentPageProduct = publicProduct(product("A"));
    mocks.interpretation.mockResolvedValueOnce(interpretation("ASK_PRODUCT_FIT"));

    const result = await processConversationTurn({ state, message: "este me sirve?", currentPageProduct: { id: "A", slug: "a", name: "Product A", productFamily: "club" } });
    expect(result.state.referenceResolution).toEqual({ productId: "A", source: "CURRENT_PAGE" });
  });

  it("uses an explicit card click ahead of old focused context", async () => {
    const state = knownLeftState();
    state.lastCatalogResults = [product("A"), product("B"), product("C")];
    state.lastInteractedProduct = product("B");
    state.lastFocusedProduct = product("C");
    state.focusedProductSource = "PRODUCT_CARD_CLICK";
    mocks.interpretation.mockResolvedValueOnce(interpretation("ASK_PRODUCT_FIT"));

    const result = await processConversationTurn({ state, message: "este me sirve?" });
    expect(result.state.referenceResolution).toEqual({ productId: "B", source: "PRODUCT_CARD_CLICK" });
  });

  it.each([
    ["por qué este es para mí?", "ASK_PRODUCT_REASON", "PERSONAL_FIT_REASON"],
    ["revisemos", "CONFIRMATION", null],
    ["adelante", "CONFIRMATION", null],
    ["quiero saber si me sirve", "ASK_PRODUCT_FIT", null],
  ] as const)("never re-asks known LEFT for %s", async (message, dialogueAct, reasonMode) => {
    const state = knownLeftState();
    state.lastFocusedProduct = product("A");
    state.focusedProductSource = "RECOMMENDATION";
    if (dialogueAct === "CONFIRMATION") {
      state.pendingAssistantOffer = { action: "START_PRODUCT_ADVICE", targetProductIds: ["A"], createdAtTurn: 1 };
    }
    mocks.interpretation.mockResolvedValueOnce(interpretation(dialogueAct, { reasonMode: reasonMode ?? undefined }));

    const result = await processConversationTurn({ state, message });
    expect(result.state.pendingQuestionKey).not.toBe("handedness");
    expect(result.state.productAdvice.pendingQuestionKey).not.toBe("handedness");
  });

  it("returns hard incompatibility in the same turn for LEFT player and RIGHT product", async () => {
    const state = knownLeftState();
    state.lastFocusedProduct = product("RIGHT-DRIVER", "RIGHT");
    state.focusedProductSource = "RECOMMENDATION";
    mocks.interpretation.mockResolvedValueOnce(interpretation("ASK_PRODUCT_FIT"));

    const result = await processConversationTurn({ state, message: "este me sirve?" });
    expect(result.state.compatibilityOutcome).toBe("HARD_INCOMPATIBLE");
    expect(result.state.lastExecutedAction).toBe("RETURN_HARD_INCOMPATIBILITY");
    expect(result.state.pendingQuestionKey).not.toBe("handedness");
    expect(result.state.pendingQuestionKey).not.toBe("skill");
  });

  it.each([
    ["por qué este es para mí?", "ASK_PRODUCT_REASON", "PERSONAL_FIT_REASON"],
    ["adelante", "CONFIRMATION", null],
  ] as const)("checks incompatibility before any question for %s", async (message, dialogueAct, reasonMode) => {
    const state = knownLeftState();
    state.lastFocusedProduct = product("RIGHT-DRIVER", "RIGHT");
    state.focusedProductSource = "RECOMMENDATION";
    if (dialogueAct === "CONFIRMATION") {
      state.pendingAssistantOffer = { action: "START_PRODUCT_ADVICE", targetProductIds: ["RIGHT-DRIVER"], createdAtTurn: 1 };
    }
    mocks.interpretation.mockResolvedValueOnce(interpretation(dialogueAct, { reasonMode: reasonMode ?? undefined }));

    const result = await processConversationTurn({ state, message });
    expect(result.state.compatibilityOutcome).toBe("HARD_INCOMPATIBLE");
    expect(result.state.lastExecutedAction).toBe("RETURN_HARD_INCOMPATIBILITY");
    expect(result.state.pendingQuestionKey).toBeNull();
  });

  it("uses the centrally eligible material question during active advice", async () => {
    const state = knownLeftState();
    const focused = product("A");
    state.lastFocusedProduct = focused;
    state.focusedProductSource = "RECOMMENDATION";
    state.pendingQuestionCategory = "PRODUCT_ADVICE";
    state.productAdvice = { active: true, product: focused, pendingQuestionKey: "setExperience", collectedAnswers: { handedness: "LEFT" } };
    mocks.interpretation.mockResolvedValueOnce(interpretation("ASK_WHAT_INFORMATION_NEEDED", { asksWhat: true }));

    const result = await processConversationTurn({ state, message: "qué dato te falta?" });
    expect(result.state.pendingQuestionKey).toBe("setExperience");
    expect(result.reply).not.toMatch(/juegas como diestro o zurdo/i);
  });
});
