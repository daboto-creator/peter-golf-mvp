import { describe, expect, it } from "vitest";

import { initialConversationState, type CatalogProductReference } from "./conversation";
import {
  activateBestRoundProIdentity,
  bestRoundProStorageKey,
  persistProductCardClick,
  resolveBestRoundProIdentity,
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

    const identity = { scope: "anonymous:anon-test" };
    const nextState = persistProductCardClick(storage, initialConversationState(), clickedProduct, identity);
    const sessionKey = bestRoundProStorageKey(identity, "session");
    const productKey = bestRoundProStorageKey(identity, "current-product");
    const persistedState = JSON.parse(writes.find(([key]) => key === sessionKey)?.[1] ?? "null");
    const persistedContext = JSON.parse(writes.find(([key]) => key === productKey)?.[1] ?? "null");

    expect(writes[0]?.[0]).toBe(sessionKey);
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

  it("restores an anonymous conversation only in its anonymous namespace", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
    const identity = resolveBestRoundProIdentity(storage as Storage, null, () => "anon-1");
    const saved = initialConversationState();
    saved.messages = [{ role: "user", content: "anonymous conversation" }];
    values.set(bestRoundProStorageKey(identity, "session"), JSON.stringify(saved));

    expect(activateBestRoundProIdentity(storage as Storage, identity).state.messages).toEqual(saved.messages);
    expect(identity.scope).toBe("anonymous:anon-1");
  });

  it("resets when identity changes and never reads another user's namespace", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
    const anonymous = resolveBestRoundProIdentity(storage as Storage, null, () => "anon-2");
    activateBestRoundProIdentity(storage as Storage, anonymous);
    const userA = resolveBestRoundProIdentity(storage as Storage, "auth-a", () => "unused");
    const privateState = initialConversationState();
    privateState.messages = [{ role: "user", content: "A only" }];
    values.set(bestRoundProStorageKey(userA, "session"), JSON.stringify(privateState));
    expect(activateBestRoundProIdentity(storage as Storage, userA).state.messages).toEqual([]);

    const userB = resolveBestRoundProIdentity(storage as Storage, "auth-b", () => "unused");
    expect(activateBestRoundProIdentity(storage as Storage, userB).state.messages).toEqual([]);
    expect(values.get(bestRoundProStorageKey(userA, "session"))).toContain("A only");
  });

  it("restores an authenticated user's own saved conversation on reload", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
    const userA = resolveBestRoundProIdentity(storage as Storage, "auth-a", () => "unused");
    activateBestRoundProIdentity(storage as Storage, userA);
    const saved = initialConversationState();
    saved.messages = [{ role: "user", content: "A's own conversation" }];
    values.set(bestRoundProStorageKey(userA, "session"), JSON.stringify(saved));

    expect(activateBestRoundProIdentity(storage as Storage, userA).state.messages).toEqual(saved.messages);
  });
});
