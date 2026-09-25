import {
  applyProductCardSelection,
  type CatalogProductReference,
  type ConversationState,
} from "./conversation";

export const BEST_ROUND_PRO_SESSION_KEY = "best-round-pro-session";
export const BEST_ROUND_PRO_CURRENT_PRODUCT_KEY = "best-round-pro-current-product";

export function persistProductCardClick(
  storage: Pick<Storage, "setItem">,
  state: ConversationState,
  product: CatalogProductReference,
) {
  const nextState = applyProductCardSelection(state, product);
  const productContext = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    productFamily: product.family,
    source: "PRODUCT_CARD_CLICK" as const,
  };

  // Persist the complete state synchronously before a Link transition or shell
  // close can unmount the chat. Each Web Storage setItem is synchronous; the
  // state document atomically contains both focus fields and their provenance.
  storage.setItem(BEST_ROUND_PRO_SESSION_KEY, JSON.stringify(nextState));
  storage.setItem(BEST_ROUND_PRO_CURRENT_PRODUCT_KEY, JSON.stringify(productContext));
  return nextState;
}
