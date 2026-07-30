import { describe, expect, it } from "vitest";

import {
  generateProductSlug,
  isValidProductSlug,
  parseMoneyToMinorUnits,
  validateProductForm,
  type ProductFormValues,
} from "@/lib/catalog/product-validation";

const validProduct: ProductFormValues = {
  name: "Driver de prueba",
  slug: "",
  sku: "pg-driver-001",
  brandId: "00000000-0000-4000-8000-000000000001",
  categoryId: "00000000-0000-4000-8000-000000000002",
  shortDescription: "Driver nuevo para prueba.",
  description: "Descripción completa del producto.",
  condition: "new",
  conditionGrade: "",
  conditionNotes: "",
  fulfillmentType: "in_stock",
  price: "1250.50",
  compareAtPrice: "1500",
  currency: "MXN",
  priceIsEstimate: false,
  leadTimeMinDays: "",
  leadTimeMaxDays: "",
  featured: false,
  published: true,
};

describe("product validation", () => {
  it("converts decimal prices to exact minor units", () => {
    expect(parseMoneyToMinorUnits("1250.50")).toBe(125050);
    expect(parseMoneyToMinorUnits("0.9")).toBe(90);
    expect(parseMoneyToMinorUnits("-1")).toBeNull();
    expect(parseMoneyToMinorUnits("10.999")).toBeNull();
  });

  it("generates and validates safe slugs", () => {
    expect(generateProductSlug("  Púter Clásico Nº 2  ")).toBe(
      "puter-clasico-n-2",
    );
    expect(isValidProductSlug("puter-clasico-n-2")).toBe(true);
    expect(isValidProductSlug("../producto")).toBe(false);
  });

  it("normalizes a valid product and generates its slug", () => {
    const result = validateProductForm(validProduct);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        slug: "driver-de-prueba",
        sku: "PG-DRIVER-001",
        price: 125050,
        compareAtPrice: 150000,
      });
    }
  });

  it("requires condition details for a used product", () => {
    const result = validateProductForm({
      ...validProduct,
      condition: "used",
      conditionGrade: "",
      conditionNotes: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.conditionGrade).toBeDefined();
      expect(result.errors.conditionNotes).toBeDefined();
    }
  });

  it("rejects inconsistent comparison price and lead time", () => {
    const result = validateProductForm({
      ...validProduct,
      compareAtPrice: "1000",
      fulfillmentType: "special_order",
      leadTimeMinDays: "10",
      leadTimeMaxDays: "5",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.compareAtPrice).toBeDefined();
      expect(result.errors.leadTimeMaxDays).toBeDefined();
    }
  });

  it("rejects lead times outside the operational range", () => {
    const result = validateProductForm({
      ...validProduct,
      fulfillmentType: "preorder",
      leadTimeMinDays: "1",
      leadTimeMaxDays: "3651",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.leadTimeMaxDays).toBeDefined();
    }
  });

  it("requires public descriptions before publication", () => {
    const result = validateProductForm({
      ...validProduct,
      shortDescription: "",
      description: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.shortDescription).toBeDefined();
      expect(result.errors.description).toBeDefined();
    }
  });
});
