import { describe, expect, it } from "vitest";

import { isCatalogIntent, routeConversationIntent } from "./intent-router";
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
});
