import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatMoneyMinorUnits,
  getAvailabilityPresentation,
  getConditionLabel,
  resolvePublicImagePath,
} from "@/lib/catalog/presentation";

describe("catalog presentation", () => {
  afterEach(() => vi.unstubAllEnvs());

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

  it("prioritizes the normalized 1–10 score when available", () => {
    expect(getConditionLabel("used", "excellent", 9)).toBe("Seminuevo · 9/10");
  });

  it("accepts safe local paths and rejects arbitrary remote-looking paths", () => {
    expect(resolvePublicImagePath("/catalog/demo-product.webp")).toBe(
      "/catalog/demo-product.webp",
    );
    expect(resolvePublicImagePath("catalog/demo-product.webp")).toBeNull();
    expect(resolvePublicImagePath("//example.com/product.webp")).toBeNull();
    expect(resolvePublicImagePath("/catalog/../secret")).toBeNull();
  });

  it("resolves only valid product Storage paths against Supabase", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    expect(
      resolvePublicImagePath(
        "products/7f1a86ef-ae15-4f8a-8bb2-0cf5f414bf4b/5445b0de-cdb8-4864-a755-aa6715d289a0.webp",
      ),
    ).toBe(
      "http://127.0.0.1:54321/storage/v1/object/public/product-images/products/7f1a86ef-ae15-4f8a-8bb2-0cf5f414bf4b/5445b0de-cdb8-4864-a755-aa6715d289a0.webp",
    );
    expect(
      resolvePublicImagePath("products/not-a-uuid/external.webp"),
    ).toBeNull();
  });
});
