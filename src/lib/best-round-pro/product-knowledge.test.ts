import { describe, expect, it } from "vitest";

import { vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  answerProductKnowledge,
  answerStoreKnowledge,
  classifyKnowledgeIntent,
  productReadiness,
  humanizeCatalogLabel,
  formatMoney,
  evaluatePlayerLevelFit,
  interpretCategoryRecommendation,
  normalizeCustomerPunctuation,
} from "./product-knowledge";
import type { ProductKnowledgeDTO } from "./product-knowledge";

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
    const product: ProductKnowledgeDTO = {
      id: "synthetic-driver",
      slug: "synthetic-driver",
      name: "Synthetic Driver Alpha",
      canonicalProductFamily: "DRIVER",
      price: 100,
      currency: "MXN",
      formattedPrice: "$1.00 MXN",
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
    };
    const answer = answerProductKnowledge("PRODUCT_SPEC", product, "¿cuánto pesa la varilla?");
    expect(answer).toContain("No tengo registrado el peso");
    const knownAnswer = answerProductKnowledge("PRODUCT_SPEC", { ...product, specs: { ...product.specs, shaftFlex: "regular" } }, "¿qué flex tiene?");
    expect(knownAnswer?.toLowerCase()).toContain("regular");
  });

  it("keeps store policy answers honest when policy is not configured", () => {
    expect(answerStoreKnowledge("STORE_SHIPPING")).toMatch(/hacemos envíos/i);
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

  it("uses customer-safe labels for stored composition values", () => {
    expect(humanizeCatalogLabel("fairway_wood")).toBe("madera de fairway");
    expect(humanizeCatalogLabel("iron")).toBe("hierros");
  });

  it("formats integer cents without exposing raw money storage", () => {
    expect(formatMoney({ amountCents: 1119900, currency: "MXN" })).toBe("$11,199.00 MXN");
    expect(formatMoney({ amountCents: 12345, currency: "MXN" })).toBe("$123.45 MXN");
    expect(formatMoney({ amountCents: 0, currency: "MXN" })).toBe("$0.00 MXN");
  });

  it.each([
    ["DRIVER", "10.5°"],
    ["FAIRWAY_WOOD", "fairway"],
    ["HYBRID", "hierros"],
    ["IRON", "juego de hierros"],
    ["WEDGE", "distancia"],
    ["PUTTER", "postura"],
    ["SET", "set"],
  ] as const)("uses natural es-MX golf language for %s", (...row) => {
    const [family, expected] = row;
    const result = interpretCategoryRecommendation({
      family,
      product: {
        id: "synthetic", slug: "synthetic", name: "Synthetic 56°", canonicalProductFamily: family,
        price: 100, currency: "MXN", formattedPrice: "$1.00 MXN", availability: "AVAILABLE", sellable: true,
        condition: "NEW", handedness: "right", brand: "Synthetic", model: "Synthetic", specs: { loftDegrees: 10.5, shaftFlex: "Regular", shaftMaterial: "graphite" }, includedItems: null,
        headcoverStatus: "UNKNOWN", sourceType: "FIRST_PARTY", sellerIdentityExposed: false, readiness: "READY", missingRequiredFields: [], missingRecommendedFields: [],
      },
      answers: { handicapIndex: 8, skill: "ADVANCED", currentWedgeLofts: [60] },
      targetPlayerLevel: family === "SET" ? "BEGINNER" : null,
    });
    expect(result.reason).toMatch(new RegExp(expected, "i"));
    expect(`${result.reason} ${result.caveat ?? ""}`).not.toMatch(/GRAPHITE|shaftMaterial|shaftFlex|starter_set|entry-level|solapamiento|papel de menor loft|golpes de más loft/);
  });

  it("describes a 10.5° Regular graphite driver naturally", () => {
    const result = interpretCategoryRecommendation({
      family: "DRIVER",
      product: {
        id: "driver", slug: "driver", name: "Synthetic Driver", canonicalProductFamily: "DRIVER",
        price: 100, currency: "MXN", formattedPrice: "$1.00 MXN", availability: "AVAILABLE", sellable: true,
        condition: "NEW", handedness: "right", brand: "Synthetic", model: "Driver", specs: { loftDegrees: 10.5, shaftFlex: "REGULAR", shaftMaterial: "GRAPHITE" }, includedItems: null,
        headcoverStatus: "UNKNOWN", sourceType: "FIRST_PARTY", sellerIdentityExposed: false, readiness: "READY", missingRequiredFields: [], missingRecommendedFields: [],
      },
      answers: { driverObjective: "DISTANCE" },
    });
    expect(result.reason).toMatch(/10\.5°.*varilla Regular de grafito/i);
    expect(result.reason).toMatch(/bola.*distancia.*ritmo de swing/i);
    expect(result.reason).not.toMatch(/shaft regular de graphite/i);
  });

  it("explains the gap between a current 60° and candidate 56° naturally", () => {
    const result = interpretCategoryRecommendation({
      family: "WEDGE",
      product: {
        id: "wedge", slug: "wedge", name: "Synthetic 56°", canonicalProductFamily: "WEDGE",
        price: 100, currency: "MXN", formattedPrice: "$1.00 MXN", availability: "AVAILABLE", sellable: true,
        condition: "NEW", handedness: "right", brand: "Synthetic", model: "Wedge", specs: { loftDegrees: 56 }, includedItems: null,
        headcoverStatus: "UNKNOWN", sourceType: "FIRST_PARTY", sellerIdentityExposed: false, readiness: "READY", missingRequiredFields: [], missingRecommendedFields: [],
      },
      answers: { currentWedgeLofts: [60] },
    });
    expect(result.reason).toMatch(/60°.*56°.*distancia.*vuelo menos alto/i);
    expect(result.caveat).toMatch(/otros wedges.*otro loft/i);
    expect(`${result.reason} ${result.caveat}`).not.toMatch(/solapamiento|papel de menor loft|golpes de más loft/i);
  });

  it.each([
    ["INTERMEDIATE", "BEGINNER", "POOR_PLAYER_LEVEL_FIT"],
    ["ADVANCED", "BEGINNER", "POOR_PLAYER_LEVEL_FIT"],
    ["BEGINNER", "BEGINNER", "MATCH"],
    ["INTERMEDIATE", "UNKNOWN", "UNKNOWN"],
  ] as const)("evaluates %s against %s as %s", (playerLevel, targetPlayerLevel, expected) => {
    expect(evaluatePlayerLevelFit({ playerLevel, targetPlayerLevel })).toBe(expected);
  });

  it("cleans duplicated terminal punctuation without changing decimals", () => {
    expect(normalizeCustomerPunctuation("Tiene 10.5° y buen ritmo..  Sigue... .")).toBe("Tiene 10.5° y buen ritmo. Sigue.");
  });
});
