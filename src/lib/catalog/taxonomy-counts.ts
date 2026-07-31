export function countEmbeddedProducts(
  products: readonly { id: string }[],
): number {
  return products.length;
}
