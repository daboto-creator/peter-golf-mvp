import { describe, expect, it } from "vitest";

import { vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  answerProductKnowledge,
  answerStoreKnowledge,
  classifyKnowledgeIntent,
  productReadiness,
} from "./product-knowledge";

describe("Best Round product knowledge", () => {
  it.each([
    ["¿cuánto cuesta?", "PRODUCT_PRICE"],
    ["¿está disponible?", "PRODUCT_AVAILABILITY"],
    ["¿es usado?", "PRODUCT_CONDITION"],
    ["¿qué flex tiene?", "PRODUCT_SPEC"],
    ["¿qué incluye este set?", "PRODUCT_CONTENTS"],
    ["¿hacen envíos?", "STORE_SHIPPING"],
    ["¿cómo funcionan las devoluciones?", "STORE_RETURNS"],
  ] as const)("classifies direct knowledge question %s", (message, expected) => {
    expect(classifyKnowledgeIntent(message)).toBe(expected);
  });

  it("answers facts without inventing a missing spec", () => {
    const answer = answerProductKnowledge("PRODUCT_SPEC", {
      id: "synthetic-driver",
      slug: "synthetic-driver",
      name: "Synthetic Driver Alpha",
      canonicalProductFamily: "DRIVER",
      price: 100,
      currency: "MXN",
      availability: "AVAILABLE",
      sellable: true,
      condition: "NEW",
      handedness: "right",
      brand: "Synthetic",
      model: "Alpha",
      specs: { shaftFlex: null, loftDegrees: 10.5 },
      includedItems: null,
      headcoverStatus: "UNKNOWN",
      sourceType: "FIRST_PARTY",
      sellerIdentityExposed: false,
      readiness: "PARTIAL",
      missingRequiredFields: [],
      missingRecommendedFields: ["shaftFlex"],
    });
    expect(answer).toContain("loftDegrees");
    expect(answer).not.toContain("Regular");
  });

  it("keeps store policy answers honest when policy is not configured", () => {
    expect(answerStoreKnowledge("STORE_SHIPPING")).toMatch(/política pública/i);
    expect(answerStoreKnowledge("STORE_TRADE_IN")).toMatch(/no puedo aceptar/i);
  });

  it("derives readiness without blocking a partial product", () => {
    expect(productReadiness({
      family: "DRIVER",
      brand: "Synthetic",
      model: "Alpha",
      price: 100,
      condition: "new",
      availability: "AVAILABLE",
      specs: { shaftFlex: null },
    }).readiness).toBe("PARTIAL");
    expect(productReadiness({
      family: null,
      brand: null,
      model: null,
      price: null,
      condition: null,
      availability: "UNKNOWN",
    }).readiness).toBe("INSUFFICIENT");
  });
});
