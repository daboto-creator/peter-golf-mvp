import type { RankedRecommendationCandidate } from "@/lib/recommendations/commercial-ranking";
import type { InventoryUnit } from "@/lib/mi-golf/domain";

const PUBLIC_SPEC_KEYS = [
  "handedness",
  "loftDegrees",
  "shaftFlex",
  "shaftMaterial",
  "shaftWeightGrams",
  "adjustableLoft",
  "adjustableHosel",
  "forgiveness",
  "drawBias",
  "setMakeup",
  "bounceDegrees",
  "grind",
  "putterHeadType",
  "strokeFit",
  "lengthInches",
  "lieDegrees",
  "clubLengthInches",
] as const;

export type GroundedProductFacts = {
  brand: string | null;
  model: string | null;
  category: string;
  source: "FIRST_PARTY" | "MARKETPLACE";
  condition: string | null;
  priceMxnMinor: number | null;
  availability: "AVAILABLE";
  availableQuantity: number | null;
  specifications: Record<string, unknown>;
  matchScore: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reasons: string[];
  missingData: string[];
};

export type GroundedFacts = {
  targetPlayer: "SELF" | "THIRD_PARTY" | "UNKNOWN";
  playerFacts: Record<string, string | number | number[]>;
  products: GroundedProductFacts[];
};

function safeSpecifications(unit: InventoryUnit) {
  const specs = unit.technicalSpecs as unknown as Record<string, unknown>;
  return Object.fromEntries(
    PUBLIC_SPEC_KEYS.flatMap((key) => {
      const value = specs[key];
      return value === null || value === undefined ? [] : [[key, value]];
    }),
  );
}

function safePlayerFacts(
  facts: Record<string, unknown>,
): Record<string, string | number | number[]> {
  const allowed = new Set([
    "handedness",
    "handicap",
    "handicapIndex",
    "skill",
    "setExperience",
    "shotTendency",
    "swingSpeed",
    "driverObjective",
    "objective",
    "currentWedgeLofts",
    "targetWedgeDistanceYards",
    "goal",
  ]);
  const result: Record<string, string | number | number[]> = {};
  for (const [key, value] of Object.entries(facts)) {
    if (!allowed.has(key)) continue;
    if (typeof value === "string" || typeof value === "number")
      result[key] = value;
    else if (
      Array.isArray(value) &&
      value.every((item) => typeof item === "number")
    )
      result[key] = value;
  }
  return result;
}

export function buildGroundedFacts(input: {
  recommendations: RankedRecommendationCandidate[];
  availableUnits: InventoryUnit[];
  playerFacts: Record<string, unknown>;
  targetPlayer: GroundedFacts["targetPlayer"];
}): GroundedFacts {
  return {
    targetPlayer: input.targetPlayer,
    playerFacts: safePlayerFacts(input.playerFacts),
    products: input.recommendations.map(
      ({ candidate, equipmentMatch, safeReasons }) => ({
        brand: candidate.brand,
        model: candidate.model,
        category: String(candidate.category),
        source: candidate.source,
        condition: candidate.condition,
        priceMxnMinor: candidate.priceMxnMinor,
        availability: "AVAILABLE",
        availableQuantity: candidate.stock,
        specifications: safeSpecifications(candidate),
        matchScore: equipmentMatch.matchScore,
        confidence: equipmentMatch.confidence,
        reasons: safeReasons,
        missingData: equipmentMatch.missingData.map((item) => item.field),
      }),
    ),
  };
}

export type GroundingIssue =
  | "EMPTY_EXPLANATION"
  | "UNRECOMMENDED_MODEL"
  | "WRONG_PRICE"
  | "WRONG_HANDEDNESS"
  | "WRONG_CONDITION"
  | "WRONG_LOFT"
  | "WRONG_SHAFT_FLEX"
  | "WRONG_AVAILABILITY"
  | "WRONG_PLAYER_FACT"
  | "WRONG_CATEGORY"
  | "UNSUPPORTED_PERFORMANCE_CLAIM";

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX");
}

export function validateGroundedExplanation(
  text: string,
  facts: GroundedFacts,
  knownCatalogModels: string[] = [],
): GroundingIssue[] {
  const issues: GroundingIssue[] = [];
  const normalized = normalize(text.trim());
  if (!normalized) return ["EMPTY_EXPLANATION"];
  const products = facts.products;
  const allowedModels = new Set(
    products.map((product) => normalize(product.model ?? "")).filter(Boolean),
  );
  if (
    knownCatalogModels.some((model) => {
      const candidate = normalize(model);
      return (
        candidate.length >= 4 &&
        normalized.includes(candidate) &&
        !allowedModels.has(candidate)
      );
    })
  )
    issues.push("UNRECOMMENDED_MODEL");

  const currencyAmounts = [...text.matchAll(/(?:\$|\bMXN\s*)(\d[\d,.]*)/gi)]
    .map((match) => Number(match[1].replace(/,/g, "")))
    .filter(Number.isFinite);
  if (
    currencyAmounts.some(
      (amount) =>
        !products.some(
          (product) =>
            product.priceMxnMinor !== null &&
            Math.abs(amount - product.priceMxnMinor / 100) < 0.01,
        ),
    )
  )
    issues.push("WRONG_PRICE");

  const hands = new Set(
    products
      .map((product) =>
        String(product.specifications.handedness ?? "").toUpperCase(),
      )
      .filter(Boolean),
  );
  if (
    (hands.has("RIGHT") &&
      /\b(?:zurd[oa]s?|izquierd[oa]s?)\b/.test(normalized)) ||
    (hands.has("LEFT") && /\b(?:diestr[oa]s?|derech[oa]s?)\b/.test(normalized))
  )
    issues.push("WRONG_HANDEDNESS");

  const conditions = new Set(
    products.map((product) => String(product.condition ?? "").toLowerCase()),
  );
  if (
    (conditions.has("new") &&
      /\b(?:usado|usada|seminuevo|seminueva)\b/.test(normalized)) ||
    (conditions.has("used") && /\b(?:nuevo|nueva)\b/.test(normalized))
  )
    issues.push("WRONG_CONDITION");

  const expectedLofts = new Set(
    products
      .flatMap((product) => [
        product.specifications.loftDegrees,
        product.specifications.bounceDegrees,
      ])
      .filter((value): value is number => typeof value === "number"),
  );
  const statedLofts = [
    ...text.matchAll(/\b(\d{1,2}(?:\.\d+)?)\s*(?:°|grados?)\b/gi),
  ].map((match) => Number(match[1]));
  if (statedLofts.some((loft) => !expectedLofts.has(loft)))
    issues.push("WRONG_LOFT");

  const flexes = new Set(
    products
      .map((product) =>
        normalize(String(product.specifications.shaftFlex ?? "")),
      )
      .filter(Boolean),
  );
  const statedFlexes = [
    "regular",
    "stiff",
    "senior",
    "ladies",
    "x-stiff",
    "extra stiff",
  ].filter((flex) => normalized.includes(flex));
  if (
    statedFlexes.some(
      (flex) =>
        ![...flexes].some(
          (expected) => expected.includes(flex) || flex.includes(expected),
        ),
    )
  )
    issues.push("WRONG_SHAFT_FLEX");

  const claimedUnits = [
    ...normalized.matchAll(
      /\b(?:hay|quedan|disponibles?)\s+(\d+)\s+(?:unidades?|piezas?)\b/g,
    ),
  ].map((match) => Number(match[1]));
  if (
    claimedUnits.some(
      (count) =>
        !products.some((product) => product.availableQuantity === count),
    ) ||
    (/\b(?:agotad[oa]s?|sin stock|no disponible)\b/.test(normalized) &&
      products.some((product) => product.availability === "AVAILABLE"))
  )
    issues.push("WRONG_AVAILABILITY");

  const handicap =
    facts.playerFacts.handicapIndex ?? facts.playerFacts.handicap;
  const statedHandicaps = [
    ...normalized.matchAll(
      /\b(?:handicap|h[áa]ndicap)\s*(?:de|:)?\s*(\d{1,2}(?:\.\d+)?)\b/g,
    ),
  ].map((match) => Number(match[1]));
  if (
    typeof handicap === "number" &&
    statedHandicaps.some((value) => value !== handicap)
  )
    issues.push("WRONG_PLAYER_FACT");

  const expectedCategories = new Set(
    products.map((product) => product.category),
  );
  const categoryMentions: Array<[RegExp, string]> = [
    [/\b(?:driver|drive)\b/, "DRIVER"],
    [/\b(?:madera(?:s)?|fairway)\b/, "FAIRWAY_WOOD"],
    [/\b(?:hibrido|hybrid|rescue)\b/, "HYBRID"],
    [/\b(?:hierros?|irons?)\b/, "IRON"],
    [/\bwedges?\b/, "WEDGE"],
    [/\bputters?\b/, "PUTTER"],
    [/\b(?:set|juego completo)\b/, "SET"],
  ];
  if (
    categoryMentions.some(
      ([pattern, category]) =>
        pattern.test(normalized) && !expectedCategories.has(category),
    )
  )
    issues.push("WRONG_CATEGORY");

  const unsupportedClaim =
    /\b(?:mas perdonador|mas forgiveness|forgiving|forgiveness|perdona mas|mas distancia|ganaras distancia|te dara mas distancia|te dara mas estabilidad|mas estable|mas estabilidad|menos spin|mas spin|genera menos spin|menor spin|mayor lanzamiento|lanzamiento (?:mas alto|alto)|mas lanzamiento|launch mas alto|mejor feel|mejor sensacion)\b/.test(
      normalized,
    );
  if (unsupportedClaim) issues.push("UNSUPPORTED_PERFORMANCE_CLAIM");
  return [...new Set(issues)];
}

export function groundedExplanationOrFallback(input: {
  generated: string;
  fallback: string;
  facts: GroundedFacts;
  knownCatalogModels?: string[];
}) {
  const issues = validateGroundedExplanation(
    input.generated,
    input.facts,
    input.knownCatalogModels,
  );
  return {
    text: issues.length === 0 ? input.generated.trim() : input.fallback,
    grounded: issues.length === 0,
    issues,
  };
}

export function lowConfidenceCaveat(input: {
  confidence: "HIGH" | "MEDIUM" | "LOW";
  missingData: string[];
}) {
  if (input.confidence !== "LOW") return null;
  const missing = input.missingData.slice(0, 2);
  return missing.length
    ? `La opción es provisional: la confianza es baja porque faltan datos sobre ${missing.join(" y ")}.`
    : "La opción es provisional: la confianza de compatibilidad es baja y conviene confirmar un dato más antes de decidir.";
}
