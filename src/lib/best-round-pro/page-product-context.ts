"use client";

import { useSyncExternalStore } from "react";

import type { ConversationProductContext } from "./conversation";

let currentPageProduct: ConversationProductContext | null = null;
const listeners = new Set<() => void>();

export function getCurrentPageProduct() {
  return currentPageProduct;
}

export function setCurrentPageProduct(product: ConversationProductContext) {
  currentPageProduct = product;
  listeners.forEach((listener) => listener());
}

export function clearCurrentPageProduct(expectedId?: string) {
  if (expectedId && currentPageProduct?.id !== expectedId) return;
  if (!currentPageProduct) return;
  currentPageProduct = null;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCurrentPageProduct() {
  return useSyncExternalStore(subscribe, getCurrentPageProduct, () => null);
}
