import { describe, expect, it } from "vitest";

import {
  buildProductSkuBase,
  generateBrandCode,
  generateLoftCode,
  generateModelCode,
  type ProductSkuInput,
} from "@/lib/catalog/product-sku";

const driver: ProductSkuInput = {
  brandName: "Titleist",
  productFamily: "club",
  clubType: "driver",
  bagType: "",
  model: "GT3",
  loftDegrees: "9",
  ironNumber: "",
  shaftFlex: "regular",
  condition: "new",
  acquisitionChannel: "purchase",
};

describe("product SKU convention", () => {
  it("builds a new driver SKU base", () => {
    expect(buildProductSkuBase(driver)).toBe("BRPS-TIT-DRV-GT3-090-R-N");
  });

  it("builds a new wedge with decimal-safe loft", () => {
    expect(
      buildProductSkuBase({
        ...driver,
        clubType: "wedge",
        model: "SM10",
        loftDegrees: "56",
        shaftFlex: "stiff",
      }),
    ).toBe("BRPS-TIT-WDG-SM10-560-S-N");
    expect(generateLoftCode("10.5")).toBe("105");
  });

  it("distinguishes used and trade-in products", () => {
    expect(
      buildProductSkuBase({
        ...driver,
        brandName: "TaylorMade",
        model: "Stealth 2",
        loftDegrees: "10.5",
        condition: "used",
      }),
    ).toBe("BRPS-TM-DRV-ST2-105-R-U");
    expect(
      buildProductSkuBase({
        ...driver,
        condition: "used",
        acquisitionChannel: "trade_in",
      }),
    ).toBe("BRPS-TIT-DRV-GT3-090-R-T");
  });

  it("covers complete sets and bag subtypes without irrelevant loft or flex", () => {
    expect(
      buildProductSkuBase({
        ...driver,
        productFamily: "set",
        clubType: "",
        model: "Complete Set 2026",
        loftDegrees: "",
        shaftFlex: "",
      }),
    ).toBe("BRPS-TIT-SET-CMSET2026-N");
    expect(
      buildProductSkuBase({
        ...driver,
        productFamily: "bag",
        clubType: "",
        bagType: "stand_bag",
        model: "Players 4",
        loftDegrees: "",
        shaftFlex: "",
      }),
    ).toBe("BRPS-TIT-BAG-STB-PL4-N");
  });

  it("normalizes new Unicode brands and models deterministically", () => {
    expect(generateBrandCode("Mizunó")).toBe("MIZ");
    expect(generateBrandCode("Å Golf Works")).toBe("AGW");
    expect(generateModelCode("Stealth 2")).toBe("ST2");
    expect(generateBrandCode("🏌️")).toMatch(/^B[A-Z0-9]{4}$/);
  });

  it("waits for meaningful structured data", () => {
    expect(buildProductSkuBase({ ...driver, model: "" })).toBeNull();
    expect(buildProductSkuBase({ ...driver, clubType: "" })).toBeNull();
  });
});
