import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BestRoundProProductCta } from "./best-round-pro-product-cta";
import {
  clearCurrentPageProduct,
  getCurrentPageProduct,
} from "@/lib/best-round-pro/page-product-context";

const productA = {
  productId: "A",
  slug: "product-a",
  name: "Product A",
  productFamily: "WEDGE",
};
const productB = {
  productId: "B",
  slug: "product-b",
  name: "Product B",
  productFamily: "DRIVER",
};

afterEach(() => {
  cleanup();
  clearCurrentPageProduct();
});

describe("Best Round Pro authoritative product-page context", () => {
  it("hydrates the rendered product without waiting for a click", async () => {
    render(<BestRoundProProductCta {...productA} />);
    await waitFor(() => expect(getCurrentPageProduct()).toEqual({
      id: "A",
      slug: "product-a",
      name: "Product A",
      productFamily: "WEDGE",
    }));
  });

  it("updates A to B and does not let stale A cleanup clear B", async () => {
    const view = render(<BestRoundProProductCta {...productA} />);
    await waitFor(() => expect(getCurrentPageProduct()?.id).toBe("A"));

    view.rerender(<BestRoundProProductCta {...productB} />);
    await waitFor(() => expect(getCurrentPageProduct()?.id).toBe("B"));
    expect(getCurrentPageProduct()?.slug).toBe("product-b");
  });

  it("clears currentPageProduct when leaving the product page", async () => {
    const view = render(<BestRoundProProductCta {...productA} />);
    await waitFor(() => expect(getCurrentPageProduct()?.id).toBe("A"));
    view.unmount();
    expect(getCurrentPageProduct()).toBeNull();
  });
});
