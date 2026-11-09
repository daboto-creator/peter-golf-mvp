import {
  applyProductCardSelection,
  initialConversationState,
  type CatalogProductReference,
  type ConversationState,
} from "./conversation";

export const BEST_ROUND_PRO_SESSION_KEY = "best-round-pro-session";
export const BEST_ROUND_PRO_CURRENT_PRODUCT_KEY =
  "best-round-pro-current-product";
export const BEST_ROUND_PRO_IDENTITY_KEY = "best-round-pro:v2:active-identity";
export const BEST_ROUND_PRO_ANONYMOUS_ID_KEY =
  "best-round-pro:v2:anonymous-session-id";

export type BestRoundProIdentity = { scope: string };

export function resolveBestRoundProIdentity(
  storage: Pick<Storage, "getItem" | "setItem">,
  userId: string | null,
  createId: () => string,
): BestRoundProIdentity {
  if (userId) return { scope: `user:${userId}` };
  let anonymousId = storage.getItem(BEST_ROUND_PRO_ANONYMOUS_ID_KEY);
  if (!anonymousId) {
    anonymousId = createId();
    storage.setItem(BEST_ROUND_PRO_ANONYMOUS_ID_KEY, anonymousId);
  }
  return { scope: `anonymous:${anonymousId}` };
}

export function bestRoundProStorageKey(
  identity: BestRoundProIdentity,
  item: "session" | "recommendation" | "catalog-products" | "current-product",
) {
  return `best-round-pro:v2:${identity.scope}:${item}`;
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function activateBestRoundProIdentity(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  identity: BestRoundProIdentity,
) {
  const previousScope = storage.getItem(BEST_ROUND_PRO_IDENTITY_KEY);
  const changed = previousScope !== null && previousScope !== identity.scope;
  storage.setItem(BEST_ROUND_PRO_IDENTITY_KEY, identity.scope);
  // Old unscoped values are never read and can be removed now.
  storage.removeItem(BEST_ROUND_PRO_SESSION_KEY);
  storage.removeItem(BEST_ROUND_PRO_CURRENT_PRODUCT_KEY);
  storage.removeItem("best-round-pro-recommendation");
  storage.removeItem("best-round-pro-catalog-products");

  if (changed) {
    return {
      changed: true,
      state: initialConversationState(),
      recommendation: null,
      catalogProducts: [],
      currentProduct: null,
    };
  }

  const state = parseJson<ConversationState>(
    storage.getItem(bestRoundProStorageKey(identity, "session")),
    initialConversationState(),
  );
  return {
    changed: false,
    state:
      state?.session && Array.isArray(state.messages)
        ? {
            ...initialConversationState(),
            ...state,
            lastCatalogResults: state.lastCatalogResults ?? [],
            lastFocusedProduct: state.lastFocusedProduct ?? null,
            lastInteractedProduct: state.lastInteractedProduct ?? null,
            focusedProductSource: state.focusedProductSource ?? null,
          }
        : initialConversationState(),
    recommendation: parseJson<unknown>(
      storage.getItem(bestRoundProStorageKey(identity, "recommendation")),
      null,
    ),
    catalogProducts: parseJson<unknown[]>(
      storage.getItem(bestRoundProStorageKey(identity, "catalog-products")),
      [],
    ),
    currentProduct: parseJson<unknown>(
      storage.getItem(bestRoundProStorageKey(identity, "current-product")),
      null,
    ),
  };
}

export function persistProductCardClick(
  storage: Pick<Storage, "setItem">,
  state: ConversationState,
  product: CatalogProductReference,
  identity: BestRoundProIdentity = { scope: "anonymous:legacy" },
) {
  const nextState = applyProductCardSelection(state, product);
  const productContext = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    productFamily: product.family,
    source: "PRODUCT_CARD_CLICK" as const,
  };
  storage.setItem(
    bestRoundProStorageKey(identity, "session"),
    JSON.stringify(nextState),
  );
  storage.setItem(
    bestRoundProStorageKey(identity, "current-product"),
    JSON.stringify(productContext),
  );
  return nextState;
}
