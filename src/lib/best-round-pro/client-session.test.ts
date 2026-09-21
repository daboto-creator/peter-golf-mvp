import { describe, expect, it } from "vitest";

import { initialConversationState, type CatalogProductReference } from "./conversation";
import {
  BEST_ROUND_PRO_CURRENT_PRODUCT_KEY,
  BEST_ROUND_PRO_SESSION_KEY,
  persistProductCardClick,
} from "./client-session";

const clickedProduct: CatalogProductReference = {
  id: "B",
  slug: "product-b",
  name: "Product B",
  category: "Driver",
  condition: "new",
  price: 10000,
  productHref: "/productos/product-b",
  imagePath: null,
  handedness: "RIGHT",
  family: "club",
};

describe("Best Round Pro client session persistence", () => {
  it("synchronously persists clicked and focused product context before unmount", () => {
    const writes: Array<[string, string]> = [];
    const storage = {
      setItem(key: string, value: string) {
        writes.push([key, value]);
      },
    };

    const nextState = persistProductCardClick(storage, initialConversationState(), clickedProduct);
    const persistedState = JSON.parse(writes.find(([key]) => key === BEST_ROUND_PRO_SESSION_KEY)?.[1] ?? "null");
    const persistedContext = JSON.parse(writes.find(([key]) => key === BEST_ROUND_PRO_CURRENT_PRODUCT_KEY)?.[1] ?? "null");

    expect(writes[0]?.[0]).toBe(BEST_ROUND_PRO_SESSION_KEY);
    expect(nextState.lastInteractedProduct?.id).toBe("B");
    expect(nextState.lastFocusedProduct?.id).toBe("B");
    expect(nextState.focusedProductSource).toBe("PRODUCT_CARD_CLICK");
    expect(persistedState.lastInteractedProduct.id).toBe("B");
    expect(persistedState.lastFocusedProduct.id).toBe("B");
    expect(persistedState.focusedProductSource).toBe("PRODUCT_CARD_CLICK");
    expect(persistedContext).toEqual({
      id: "B",
      slug: "product-b",
      name: "Product B",
      productFamily: "club",
      source: "PRODUCT_CARD_CLICK",
    });
  });
});
