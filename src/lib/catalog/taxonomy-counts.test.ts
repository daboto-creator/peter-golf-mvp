import { describe, expect, it } from "vitest";

import { countEmbeddedProducts } from "@/lib/catalog/taxonomy-counts";

describe("countEmbeddedProducts", () => {
  it("counts explicitly selected embedded product ids", () => {
    expect(
      countEmbeddedProducts([{ id: "product-a" }, { id: "product-b" }]),
    ).toBe(2);
  });

  it("returns zero when a taxonomy has no products", () => {
    expect(countEmbeddedProducts([])).toBe(0);
  });
});
