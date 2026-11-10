import { describe, expect, it } from "vitest";

import {
  groundedExplanationOrFallback,
  lowConfidenceCaveat,
  validateGroundedExplanation,
  type GroundedFacts,
} from "./grounding";

const facts: GroundedFacts = {
  targetPlayer: "SELF",
  playerFacts: { handedness: "RIGHT", handicapIndex: 12 },
  products: [
    {
      brand: "Titleist",
      model: "GT3",
      category: "DRIVER",
      source: "FIRST_PARTY",
      condition: "new",
      priceMxnMinor: 1119900,
      availability: "AVAILABLE",
      availableQuantity: 3,
      specifications: {
        handedness: "RIGHT",
        loftDegrees: 9,
        shaftFlex: "REGULAR",
      },
      matchScore: 78,
      confidence: "MEDIUM",
      reasons: ["BEST_TECHNICAL_MATCH"],
      missingData: [],
    },
  ],
};

describe("Best Round Pro factual grounding", () => {
  it("accepts an explanation consistent with structured catalog facts", () => {
    expect(
      validateGroundedExplanation(
        "El Titleist GT3 es un driver nuevo, diestro, de 9° y varilla regular.",
        facts,
        ["GT3", "Qi10"],
      ),
    ).toEqual([]);
  });

  it.each([
    [
      "wrong model",
      "El Qi10 es la opción que te recomiendo.",
      "UNRECOMMENDED_MODEL",
    ],
    ["wrong price", "Cuesta $9,999.00 MXN.", "WRONG_PRICE"],
    ["wrong handedness", "Es una opción para zurdos.", "WRONG_HANDEDNESS"],
    [
      "wrong condition",
      "Este driver usado está disponible.",
      "WRONG_CONDITION",
    ],
    ["wrong loft", "Tiene loft de 10 grados.", "WRONG_LOFT"],
    ["wrong flex", "Incluye varilla stiff.", "WRONG_SHAFT_FLEX"],
    ["wrong category", "Este putter es para ti.", "WRONG_CATEGORY"],
    [
      "wrong availability",
      "Este driver está agotado y no hay stock.",
      "WRONG_AVAILABILITY",
    ],
    [
      "wrong player handicap",
      "Recuerdo que tienes handicap 8.",
      "WRONG_PLAYER_FACT",
    ],
    [
      "unsupported performance",
      "Este driver perdona más y te dará más distancia.",
      "UNSUPPORTED_PERFORMANCE_CLAIM",
    ],
  ] as const)("rejects %s claims", (_label, text, issue) => {
    expect(validateGroundedExplanation(text, facts, ["GT3", "Qi10"])).toContain(
      issue,
    );
  });

  it("gives LOW confidence recommendations a provisional caveat", () => {
    expect(
      lowConfidenceCaveat({
        confidence: "LOW",
        missingData: ["handedness", "swing speed"],
      }),
    ).toContain("La opción es provisional");
    expect(
      lowConfidenceCaveat({ confidence: "HIGH", missingData: [] }),
    ).toBeNull();
  });

  it("uses the deterministic fallback when generated text contradicts a fact", () => {
    expect(
      groundedExplanationOrFallback({
        generated: "El Qi10 cuesta $9,999 y es para zurdos.",
        fallback: "Con los datos disponibles, esta opción es provisional.",
        facts,
        knownCatalogModels: ["GT3", "Qi10"],
      }),
    ).toMatchObject({
      text: "Con los datos disponibles, esta opción es provisional.",
      grounded: false,
      issues: expect.arrayContaining([
        "UNRECOMMENDED_MODEL",
        "WRONG_PRICE",
        "WRONG_HANDEDNESS",
      ]),
    });
  });

  it("rejects comparative performance claims even when a spec label is present", () => {
    const withForgivenessLabel = {
      ...facts,
      products: [
        {
          ...facts.products[0],
          specifications: {
            ...facts.products[0].specifications,
            forgiveness: "HIGH",
          },
        },
      ],
    } satisfies GroundedFacts;
    expect(
      validateGroundedExplanation(
        "Este modelo es más perdonador que los demás.",
        withForgivenessLabel,
      ),
    ).toContain("UNSUPPORTED_PERFORMANCE_CLAIM");
  });
});
