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
  conditionScore: "",
  conditionNotes: "",
  targetPlayer: "",
  productFamily: "",
  fulfillmentType: "in_stock",
  price: "1250.50",
  compareAtPrice: "1500",
  currency: "MXN",
  priceIsEstimate: false,
  leadTimeMinDays: "",
  leadTimeMaxDays: "",
  featured: false,
  published: true,
  clubType: "",
  bagType: "",
  setType: "",
  model: "",
  modelYear: "",
  handedness: "",
  shaftMaterial: "",
  shaftBrand: "",
  shaftModel: "",
  shaftFlex: "",
  shaftWeightGrams: "",
  clubLengthInches: "",
  gripBrand: "",
  gripModel: "",
  gripCondition: "",
  headcoverIncluded: "",
  specificationNotes: "",
  loftDegrees: "",
  adjustableLoft: "",
  adjustableHosel: "",
  adjustmentToolIncluded: "",
  clubNumber: "",
  ironNumber: "",
  bounceDegrees: "",
  grind: "",
  putterHeadType: "",
  lengthInches: "",
  lieDegrees: "",
  neckType: "",
  color: "",
  dividerCount: "",
  pocketCount: "",
  weightKg: "",
  rainHoodIncluded: "",
  strapIncluded: "",
  waterproof: "",
  cartCompatible: "",
  components: [],
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

  it.each([
    ["driver", { loftDegrees: "10.5", adjustableLoft: "yes" }],
    ["wedge", { loftDegrees: "56", bounceDegrees: "12", grind: "M" }],
    ["putter", { putterHeadType: "mallet", lengthInches: "34" }],
  ] as const)(
    "normalizes structured %s specifications",
    (clubType, details) => {
      const result = validateProductForm({
        ...validProduct,
        productFamily: "club",
        clubType,
        handedness: "right",
        shaftFlex: "regular",
        shaftMaterial: "graphite",
        ...details,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.specifications).toMatchObject({
          clubType,
          handedness: "right",
          shaftFlex: "regular",
        });
      }
    },
  );

  it("normalizes a Stand Bag", () => {
    const result = validateProductForm({
      ...validProduct,
      productFamily: "bag",
      bagType: "stand_bag",
      color: "Negro",
      dividerCount: "4",
      rainHoodIncluded: "yes",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.specifications).toMatchObject({
        bagType: "stand_bag",
        dividerCount: 4,
        rainHoodIncluded: true,
      });
    }
  });

  it("requires and normalizes structured Complete Set components", () => {
    const result = validateProductForm({
      ...validProduct,
      productFamily: "set",
      setType: "complete_set",
      handedness: "right",
      components: [
        {
          componentKind: "club",
          quantity: "1",
          clubType: "driver",
          bagType: "",
          componentNumber: "",
          loftDegrees: "10.5",
          handedness: "right",
          shaftFlex: "regular",
          shaftMaterial: "graphite",
          brand: "Marca demo",
          model: "D1",
          condition: "new",
          conditionGrade: "",
        },
        {
          componentKind: "bag",
          quantity: "1",
          clubType: "",
          bagType: "stand_bag",
          componentNumber: "",
          loftDegrees: "",
          handedness: "",
          shaftFlex: "",
          shaftMaterial: "",
          brand: "Marca demo",
          model: "Carry",
          condition: "new",
          conditionGrade: "",
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.components).toHaveLength(2);
      expect(result.data.components[0]).toMatchObject({ clubType: "driver" });
      expect(result.data.components[1]).toMatchObject({
        bagType: "stand_bag",
        clubType: null,
      });
    }
  });

  it("normalizes a seminuevo score without changing the legacy condition", () => {
    const result = validateProductForm({
      ...validProduct,
      condition: "used",
      conditionGrade: "excellent",
      conditionScore: "9",
      conditionNotes: "Marcas cosméticas leves.",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        condition: "used",
        conditionGrade: "excellent",
        conditionScore: 9,
      });
    }
  });
});
