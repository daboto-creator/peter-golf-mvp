import type {
  MarketPriceInput,
  MarketPriceSource,
} from "@/lib/pricing/market-price-provider";
import type { MarketConfidence } from "@/lib/pricing/pricing-types";

export type RawMarketComparable = {
  merchant: string;
  productName: string;
  priceMxn: number;
  originalCurrency: string;
  originalPrice: string;
  url: string | null;
  identifier: string | null;
  availability: MarketPriceSource["availability"];
  condition: MarketPriceSource["condition"];
  marketScope: MarketPriceSource["marketScope"];
};

export type ComparableEvaluation = {
  accepted: boolean;
  score: number;
  confidence: Exclude<MarketConfidence, "unavailable">;
  reason: string | null;
};

const COMPONENT_ONLY_PHRASES = [
  "shaft only",
  "solo shaft",
  "varilla sola",
  "solo varilla",
  "adapter",
  "adaptador",
  "wrench",
  "llave ajuste",
];

const DISTINCT_MODEL_VARIANTS = [
  "max lite",
  "tour issue",
  "plus",
  "max",
  "hd",
  "ls",
];

const TYPE_TERMS: Record<string, string[]> = {
  driver: ["driver"],
  fairway_wood: ["fairway", "wood", "madera"],
  hybrid: ["hybrid", "hibrido"],
  iron: ["iron", "hierro"],
  wedge: ["wedge"],
  putter: ["putter"],
};

export function normalizeMarketText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/([a-z])([0-9])/g, "$1 $2")
    .replace(/([0-9])([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9.]+/g, " ")
    .trim();
}

function compact(value: string): string {
  return normalizeMarketText(value).replaceAll(" ", "");
}

function containsBrand(title: string, brand: string): boolean {
  return compact(title).includes(compact(brand));
}

function containsModel(title: string, model: string): boolean {
  if (containsTerm(title, model)) return true;
  const tokens = normalizeMarketText(model).split(" ").filter(Boolean);
  if (tokens.length < 2) return false;
  for (let start = 1; start < tokens.length - 1; start += 1) {
    const suffix = tokens.slice(start).join("");
    if (/\d/.test(suffix) && compact(title).includes(suffix)) return true;
  }
  const whole = tokens.join("");
  return /\d/.test(whole) && compact(title).includes(whole);
}

function isComponentOnly(title: string): boolean {
  if (
    COMPONENT_ONLY_PHRASES.some((term) =>
      title.includes(normalizeMarketText(term)),
    )
  ) {
    return true;
  }
  if (/\b(head|cabeza)\b/.test(title)) return true;
  return /\b(headcover|funda)\b/.test(title) && !/\b(with|con)\b/.test(title);
}

function hasDistinctVariantMismatch(title: string, model: string): boolean {
  const expected = normalizeMarketText(model);
  return DISTINCT_MODEL_VARIANTS.some(
    (variant) =>
      containsTerm(title, variant) && !containsTerm(expected, variant),
  );
}

function containsTerm(haystack: string, needle: string | null): boolean {
  if (!needle) return true;
  const normalized = normalizeMarketText(needle);
  return normalized
    .split(" ")
    .filter(Boolean)
    .every((token) => haystack.split(" ").includes(token));
}

function hasAny(haystack: string, terms: string[]): boolean {
  return terms.some((term) => haystack.includes(normalizeMarketText(term)));
}

function scoreOptional(
  title: string,
  expected: string | number | null,
  weight: number,
): number {
  if (expected === null || expected === "") return weight;
  return containsTerm(title, String(expected)) ? weight : 0;
}

function matchesHandedness(title: string, expected: string | null): boolean {
  if (!expected) return true;
  const aliases =
    expected === "right"
      ? [
          "right",
          "right hand",
          "rh",
          "diestro",
          "diestros",
          "derecha",
          "derecho",
        ]
      : [
          "left",
          "left hand",
          "lh",
          "zurdo",
          "zurdos",
          "izquierda",
          "izquierdo",
        ];
  return hasAny(title, aliases);
}

function matchesShaftFlex(title: string, expected: string | null): boolean {
  if (!expected) return true;
  const aliases: Record<string, string[]> = {
    ladies: ["ladies", "lady", "dama", "mujer", "flex l"],
    senior: ["senior", "flex a", "flex sr"],
    regular: ["regular", "flex r"],
    stiff: ["stiff", "rigido", "duro", "flex s"],
    x_stiff: ["x stiff", "extra stiff", "flex x"],
    other: [],
  };
  return hasAny(title, aliases[expected] ?? [expected]);
}

export function evaluateComparable(
  input: MarketPriceInput,
  comparable: RawMarketComparable,
): ComparableEvaluation {
  const title = normalizeMarketText(comparable.productName);
  if (isComponentOnly(title)) {
    return {
      accepted: false,
      score: 0,
      confidence: "low",
      reason: "component_only",
    };
  }
  if (!input.brand || !input.model || !containsBrand(title, input.brand)) {
    return {
      accepted: false,
      score: 0,
      confidence: "low",
      reason: "brand_mismatch",
    };
  }
  if (!containsModel(title, input.model)) {
    return {
      accepted: false,
      score: 0,
      confidence: "low",
      reason: "model_mismatch",
    };
  }
  if (hasDistinctVariantMismatch(title, input.model)) {
    return {
      accepted: false,
      score: 0,
      confidence: "low",
      reason: "variant_mismatch",
    };
  }
  const expectedTypeTerms = input.clubType ? TYPE_TERMS[input.clubType] : null;
  if (expectedTypeTerms && !hasAny(title, expectedTypeTerms)) {
    return {
      accepted: false,
      score: 0,
      confidence: "low",
      reason: "type_mismatch",
    };
  }
  if (
    input.condition === "new" &&
    comparable.condition !== "new" &&
    comparable.condition !== "unknown"
  ) {
    return {
      accepted: false,
      score: 0,
      confidence: "low",
      reason: "condition_mismatch",
    };
  }
  if (input.condition === "used" && comparable.condition === "new") {
    return {
      accepted: false,
      score: 0,
      confidence: "low",
      reason: "condition_mismatch",
    };
  }

  let score = 20 + 30 + 15;
  score += comparable.condition === input.condition ? 10 : 4;
  score += scoreOptional(title, input.modelYear, 5);
  score += scoreOptional(title, input.loftDegrees ?? input.clubNumber, 7);
  const handednessMatches = matchesHandedness(title, input.handedness);
  const shaftFlexMatches = matchesShaftFlex(title, input.shaftFlex);
  score += input.handedness ? (handednessMatches ? 5 : 0) : 5;
  score += input.shaftFlex ? (shaftFlexMatches ? 4 : 0) : 4;
  score += Math.max(
    scoreOptional(title, input.shaftModel, 4),
    scoreOptional(title, input.shaftMaterial, 4),
  );
  score = Math.min(score, 100);

  let confidence: ComparableEvaluation["confidence"] =
    score >= 85 ? "high" : score >= 70 ? "medium" : "low";
  if (
    confidence === "high" &&
    ((!handednessMatches && input.handedness) ||
      (!shaftFlexMatches && input.shaftFlex) ||
      comparable.condition !== input.condition)
  ) {
    confidence = "medium";
  }

  return {
    accepted: score >= 55,
    score,
    confidence,
    reason: score >= 55 ? null : "insufficient_match",
  };
}
