import { describe, expect, it } from "vitest";

import {
  formatMoneyMinorUnits,
  getAvailabilityPresentation,
  getConditionLabel,
  resolvePublicImagePath,
} from "@/lib/catalog/presentation";

describe("catalog presentation", () => {
  it("formats minor currency units as Mexican pesos", () => {
    expect(formatMoneyMinorUnits(125000, "MXN")).toBe("$1,250.00");
  });

  it("communicates special-order lead time", () => {
    expect(
      getAvailabilityPresentation({
        fulfillmentType: "special_order",
        leadTimeMinDays: 5,
        leadTimeMaxDays: 9,
      }),
    ).toEqual({
      label: "Sobre pedido",
      detail: "Plazo estimado: 5–9 días.",
      tone: "order",
    });
  });

  it("does not claim exact stock for in-stock fulfillment", () => {
    expect(
      getAvailabilityPresentation({
        fulfillmentType: "in_stock",
        leadTimeMinDays: null,
        leadTimeMaxDays: null,
      }).detail,
    ).toBe("Existencia sujeta a confirmación.");
  });

  it("describes used product condition grades", () => {
    expect(getConditionLabel("used", "very_good")).toBe(
      "Seminuevo · Muy bueno",
    );
  });

  it("accepts only site-relative image paths", () => {
    expect(resolvePublicImagePath("/catalog/demo-product.webp")).toBe(
      "/catalog/demo-product.webp",
    );
    expect(resolvePublicImagePath("catalog/demo-product.webp")).toBeNull();
    expect(resolvePublicImagePath("//example.com/product.webp")).toBeNull();
    expect(resolvePublicImagePath("/catalog/../secret")).toBeNull();
  });
});
