import { describe, expect, it } from "vitest";

import { isCatalogIntent, routeConversationIntent } from "./intent-router";

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
});
