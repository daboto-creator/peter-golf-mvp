import { describe, expect, it } from "vitest";

import { isAdviceMetaQuestion, isCatalogIntent, isProductAdviceLanguage, routeConversationIntent } from "./intent-router";
import { BEST_ROUND_PRO_AGENT_ASSET } from "./launcher";
import { initialConversationState } from "./conversation";

describe("Best Round Pro intent routing", () => {
  it("routes complete-set requests to catalog search", () => {
    const intent = routeConversationIntent("quiero un set completo de golf");
    expect(intent).toBe("PRODUCT_SEARCH");
    expect(isCatalogIntent(intent)).toBe(true);
  });

  it("keeps fitting requests on the recommendation path", () => {
    expect(routeConversationIntent("quiero un driver para mí")).toBe(
      "FITTING_RECOMMENDATION",
    );
    expect(routeConversationIntent("¿qué drivers tienen?")).toBe(
      "CATALOG_SEARCH",
    );
  });

  it("uses the approved launcher image as the primary asset", () => {
    expect(BEST_ROUND_PRO_AGENT_ASSET.primary).toBe(
      "/images/best-round-pro-agent-launcher.png",
    );
    expect(BEST_ROUND_PRO_AGENT_ASSET.fallback).toBe(
      "/images/best-round-pro-agent.png",
    );
  });

  it("initializes persistent product-reference context", () => {
    const state = initialConversationState();
    expect(state.lastCatalogResults).toEqual([]);
    expect(state.lastFocusedProduct).toBeNull();
  });

  it("recognizes natural product-advice language through the production helper", () => {
    for (const phrase of [
      "me lo recomiendas", "lo recomiendas", "me recomiendas este", "lo recomendarías",
      "me sirve", "me conviene", "es bueno para mí", "qué opinas de este",
      "qué tal para mí", "crees que me funcione", "vale la pena para mí",
    ]) expect(isProductAdviceLanguage(phrase), phrase).toBe(true);
  });

  it("recognizes meta questions through the production helper", () => {
    for (const phrase of [
      "que necesitas", "qué necesitas", "qué datos necesitas", "que datos necesitas",
      "qué te falta", "qué quieres saber", "qué te digo", "qué información te doy",
      "qué necesitas saber", "qué necesitas de mí",
    ]) expect(isAdviceMetaQuestion(phrase), phrase).toBe(true);
  });
});
