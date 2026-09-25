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
import { canonicalProductFamily, getLastInterpreterTelemetry, processConversationTurn, safeFamilyLanguage } from "./service";

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
  it("answers direct product price without starting fitting", async () => {
    mocks.currentPageProduct = {
      ...publicProduct(product("SYNTHETIC", "RIGHT")),
      price: 12345,
      currency: "MXN",
      fulfillmentType: "in_stock",
      brandName: "Synthetic",
      clubType: "driver",
      clubSpecs: null,
      components: [],
      accessoriesIncluded: [],
    };
    mocks.interpretation.mockResolvedValueOnce(interpretation("ASK_PRODUCT_FIT"));
    const result = await processConversationTurn({
      state: initialConversationState(),
      message: "¿cuánto cuesta?",
      currentPageProduct: { id: "SYNTHETIC", slug: "synthetic", name: "Synthetic Driver Alpha", productFamily: "DRIVER" },
    });
    expect(result.reply).toContain("$123.45 MXN");
    expect(result.state.pendingQuestionKey).toBeNull();
    expect(result.state.lastExecutedAction).toBe("RETURN_PRODUCT_PRICE");
  });

  it.each([
    ["SET", "set"], ["DRIVER", "driver"], ["FAIRWAY_WOOD", "madera"],
    ["HYBRID", "híbrido"], ["IRON", "hierros"], ["WEDGE", "wedge"], ["PUTTER", "putter"],
  ])("uses safe vocabulary for %s", (family, word) => {
    const product = { id: family, slug: family.toLowerCase(), name: family, category: family, condition: "NEW", price: 0, productHref: "", imagePath: null, handedness: null, family };
    expect(canonicalProductFamily(product)).toBe(family);
    expect(safeFamilyLanguage(product).toLowerCase()).toContain(word);
    if (family !== "SET") expect(safeFamilyLanguage(product)).not.toContain("set completo");
  });
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

  it("resolves 'este equipo me sirve' from the authoritative product page", async () => {
    const state = initialConversationState();
    mocks.currentPageProduct = publicProduct(product("PAGE-PRODUCT"));
    mocks.interpretation.mockResolvedValueOnce(interpretation("ASK_PRODUCT_FIT"));

    const result = await processConversationTurn({
      state,
      message: "este equipo me sirve?",
      currentPageProduct: { id: "PAGE-PRODUCT", slug: "page-product", name: "Product PAGE-PRODUCT", productFamily: "club" },
    });
    expect(result.state.referenceResolution).toEqual({ productId: "PAGE-PRODUCT", source: "CURRENT_PAGE" });
    expect(result.events).not.toContain("PRODUCT_REFERENCE_CLARIFICATION");
    expect(result.events).not.toContain("COMMERCIAL_CATALOG_SEARCH");
  });

  it("reuses known LEFT and immediately rejects a RIGHT current-page product", async () => {
    const state = knownLeftState();
    mocks.currentPageProduct = publicProduct(product("RIGHT-PAGE", "RIGHT"));
    mocks.interpretation.mockResolvedValueOnce(interpretation("ASK_PRODUCT_FIT"));

    const result = await processConversationTurn({
      state,
      message: "este wedge me sirve?",
      currentPageProduct: { id: "RIGHT-PAGE", slug: "right-page", name: "Product RIGHT-PAGE", productFamily: "WEDGE" },
    });
    expect(result.state.referenceResolution).toEqual({ productId: "RIGHT-PAGE", source: "CURRENT_PAGE" });
    expect(result.state.compatibilityOutcome).toBe("HARD_INCOMPATIBLE");
    expect(result.state.pendingQuestionKey).not.toBe("handedness");
    expect(result.events.some((event) => event.includes("HARD_INCOMPATIBILITY"))).toBe(true);
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
    expect(result.state.pendingQuestionKey).toBe("skill");
    expect(result.reply).not.toMatch(/juegas como diestro o zurdo/i);
  });

  it("keeps HELP_REQUEST inside active product advice", async () => {
    const state = knownLeftState();
    const focused = product("WEDGE");
    focused.category = "Wedge";
    state.lastFocusedProduct = focused;
    state.productAdvice = { active: true, product: focused, pendingQuestionKey: "skill", collectedAnswers: { handedness: "LEFT", handicapIndex: 8 } };
    state.activeAdvice = { productId: focused.id, productFamily: "WEDGE", status: "NEEDS_ONE_MORE_FACT" };
    mocks.interpretation.mockResolvedValueOnce(interpretation("HELP_REQUEST"));
    const result = await processConversationTurn({ state, message: "orientame" });
    expect(result.reply).not.toContain("buscar productos");
    expect(result.state.activeAdvice?.productFamily).toBe("WEDGE");
  });

  it("consumes 'ya juego' and 'principiante' once despite bad raw planner acts", async () => {
    const state = knownLeftState();
    const focused = product("GT3");
    state.lastFocusedProduct = focused;
    state.focusedProductSource = "PRODUCT_CARD_CLICK";
    state.pendingQuestionKey = "setExperience";
    state.pendingQuestionCategory = "PRODUCT_ADVICE";
    state.productAdvice = { active: true, product: focused, pendingQuestionKey: "setExperience", collectedAnswers: { handedness: "LEFT" } };
    mocks.interpretation.mockResolvedValueOnce({
      ...interpretation("OTHER"),
      rawDialogueAct: "ASK_SET_EXPERIENCE",
    });

    const experience = await processConversationTurn({ state, message: "ya juego" });
    expect(experience.state.session.diagnosticAnswers.setExperience).toBe("CURRENT_PLAYER");
    expect(experience.state.pendingQuestionKey).toBe("skill");
    expect(experience.reply).not.toMatch(/Para no hacerte repetir/i);
    expect(getLastInterpreterTelemetry()).toMatchObject({
      rawDialogueAct: "ASK_SET_EXPERIENCE",
      effectiveDialogueAct: "ANSWER_PENDING_QUESTION",
      pendingBefore: "setExperience",
      pendingFactKeyMatched: "setExperience",
      pendingAfter: null,
    });

    mocks.interpretation.mockResolvedValueOnce({
      ...interpretation("OTHER"),
      rawDialogueAct: "ASK_PLAYER_SKILL_LEVEL",
    });
    const skill = await processConversationTurn({ state: experience.state, message: "principiante" });
    expect(skill.state.session.diagnosticAnswers.skill).toBe("BEGINNER");
    expect(skill.state.pendingQuestionKey).not.toBe("skill");
    expect(skill.reply).not.toMatch(/Para no hacerte repetir/i);
    expect(getLastInterpreterTelemetry()).toMatchObject({
      effectiveDialogueAct: "ANSWER_PENDING_QUESTION",
      pendingFactKeyMatched: "skill",
    });
  });

  it("rejects context-echoed facts on a recommendation request", async () => {
    const state = knownLeftState();
    state.session.diagnosticAnswers.setExperience = "CURRENT_PLAYER";
    state.session.diagnosticAnswers.skill = "BEGINNER";
    state.lastFocusedProduct = product("GT3");
    state.focusedProductSource = "RECOMMENDATION";
    mocks.interpretation.mockResolvedValueOnce({
      ...interpretation("PRODUCT_ADVICE"),
      factMutationIntent: "SET_NEW",
      declaredFacts: [
        { field: "handedness", value: "RIGHT", durable: true, semanticStatus: "KNOWN", source: "CURRENT_USER_EXPLICIT" },
        { field: "setExperience", value: "FIRST_SET", durable: true, semanticStatus: "KNOWN", source: "CURRENT_USER_EXPLICIT" },
        { field: "skill", value: "BEGINNER", durable: true, semanticStatus: "KNOWN", source: "CURRENT_USER_EXPLICIT" },
      ],
    });

    const result = await processConversationTurn({ state, message: "dale recomiendame" });
    expect(result.state.session.diagnosticAnswers).toMatchObject({
      handedness: "LEFT",
      setExperience: "CURRENT_PLAYER",
      skill: "BEGINNER",
    });
    expect(getLastInterpreterTelemetry().acceptedCurrentTurnFacts).toEqual([]);
    expect(getLastInterpreterTelemetry().rejectedContextEchoFacts).toHaveLength(3);
  });

  it("allows an explicit correction to replace a known durable fact", async () => {
    const state = knownLeftState();
    mocks.interpretation.mockResolvedValueOnce({
      ...interpretation("CORRECTION"),
      rawDialogueAct: "CORRECTION",
      factMutationIntent: "CORRECT_EXISTING",
      declaredFacts: [{
        field: "handedness",
        value: "RIGHT",
        durable: true,
        semanticStatus: "KNOWN",
        source: "CURRENT_USER_CORRECTION",
      }],
    });

    const result = await processConversationTurn({ state, message: "me equivoqué, soy diestro" });
    expect(result.state.session.diagnosticAnswers.handedness).toBe("RIGHT");
    expect(getLastInterpreterTelemetry().acceptedCurrentTurnFacts).toContainEqual(expect.objectContaining({
      key: "handedness",
      canonicalValue: "RIGHT",
      source: "CURRENT_USER_CORRECTION",
    }));
  });

  it("completes the current-page driver pending sequence without repeats", async () => {
    let state = initialConversationState();
    mocks.currentPageProduct = publicProduct(product("STEALTH", "RIGHT"));
    mocks.interpretation.mockResolvedValueOnce(interpretation("ASK_PRODUCT_FIT"));
    let result = await processConversationTurn({
      state,
      message: "este palo es indicado para mi?",
      currentPageProduct: { id: "STEALTH", slug: "stealth", name: "Product STEALTH", productFamily: "DRIVER" },
    });
    expect(result.state.pendingQuestionKey).toBe("handedness");
    expect(result.state.referenceResolution.source).toBe("CURRENT_PAGE");

    for (const [message, value, next] of [
      ["diestro", "RIGHT", "skill"],
      ["8", 8, "driverObjective"],
    ] as const) {
      mocks.interpretation.mockResolvedValueOnce(interpretation("OTHER"));
      result = await processConversationTurn({
        state: result.state,
        message,
        currentPageProduct: { id: "STEALTH", slug: "stealth", name: "Product STEALTH", productFamily: "DRIVER" },
      });
      state = result.state;
      const key = message === "diestro" ? "handedness" : message === "8" ? "handicapIndex" : "objective";
      expect(state.session.diagnosticAnswers[key]).toBe(value);
      expect(state.pendingQuestionKey).toBe(next);
      expect(result.reply).not.toMatch(/Para no hacerte repetir/i);
      expect(state.conversationLoop.consecutiveSameQuestionCount).toBeLessThan(2);
      expect(state.referenceResolution.source).toBe("CURRENT_PAGE");
    }
  });

  it("offers only real same-family alternatives after a completed driver evaluation", async () => {
    const state = initialConversationState();
    state.session.diagnosticAnswers = {
      handedness: "RIGHT",
      handicapIndex: 8,
      handicapStatus: "KNOWN",
      skill: "ADVANCED",
      skillSource: "DERIVED_FROM_HANDICAP",
      driverObjective: "DISTANCE",
    };
    mocks.currentPageProduct = { ...publicProduct(product("STEALTH", "RIGHT")), clubType: "driver", productFamily: "club" };
    mocks.catalogProducts = [
      { ...publicProduct(product("STEALTH", "RIGHT")), clubType: "driver", productFamily: "club" },
      { ...publicProduct(product("OTHER", "RIGHT")), clubType: "driver", productFamily: "club" },
      { ...publicProduct(product("WEDGE", "RIGHT")), clubType: "wedge", productFamily: "club" },
    ];
    mocks.interpretation.mockResolvedValueOnce(interpretation("ASK_PRODUCT_FIT"));

    const result = await processConversationTurn({
      state,
      message: "me recomiendas este driver",
      currentPageProduct: { id: "STEALTH", slug: "stealth", name: "TaylorMade Stealth 2 Driver", productFamily: "DRIVER" },
    });

    expect(result.reply).toContain("OTHER");
    expect(result.reply).not.toContain("WEDGE");
    expect(result.reply).not.toMatch(/puedo comparar una alternativa/i);
    expect(getLastInterpreterTelemetry()).toMatchObject({
      comparableAlternativeIds: ["OTHER"],
      comparableAlternativeCount: 1,
      comparisonEligible: true,
      comparisonOffered: true,
    });
  });

  it("does not offer comparison when no same-family inventory exists", async () => {
    const state = initialConversationState();
    state.session.diagnosticAnswers = {
      handedness: "RIGHT",
      handicapIndex: 8,
      handicapStatus: "KNOWN",
      skill: "ADVANCED",
      skillSource: "DERIVED_FROM_HANDICAP",
      driverObjective: "DISTANCE",
    };
    mocks.currentPageProduct = { ...publicProduct(product("STEALTH", "RIGHT")), clubType: "driver", productFamily: "club" };
    mocks.catalogProducts = [{ ...publicProduct(product("WEDGE", "RIGHT")), clubType: "wedge", productFamily: "club" }];
    mocks.interpretation.mockResolvedValueOnce(interpretation("ASK_PRODUCT_FIT"));

    const result = await processConversationTurn({
      state,
      message: "me recomiendas este driver",
      currentPageProduct: { id: "STEALTH", slug: "stealth", name: "TaylorMade Stealth 2 Driver", productFamily: "DRIVER" },
    });

    expect(result.reply).toMatch(/no tengo otro driver comparable/i);
    expect(getLastInterpreterTelemetry().comparableAlternativeCount).toBe(0);
    expect(getLastInterpreterTelemetry().comparisonOffered).toBe(false);
  });
});
