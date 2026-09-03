import { createHash } from "node:crypto";

import type {
  MarketPriceInput,
  MarketPriceProvider,
  MarketPriceResult,
  MarketPriceSource,
} from "@/lib/pricing/market-price-provider";
import type { OfficialBrandReference } from "@/lib/pricing/official-brand-reference";

export const INTELLIGENCE_ENGINE_VERSION = "best-round-intelligence-v1";
export const RESEARCH_FINGERPRINT_VERSION = "v1";
export const CURRENCY_NORMALIZATION_VERSION = "mxn-minor-v1";
export const COMPARABLE_CLASSIFIER_VERSION =
  "product-kind-condition-certainty-v4";
export const RESEARCH_TTL_DAYS = 90;

export type ResearchProductInput = MarketPriceInput & {
  category?: string | null;
  bounceDegrees?: number | null;
  grind?: string | null;
  putterStyle?: string | null;
  setComposition?: string | null;
  researchFamily?: string | null;
  productType?: string | null;
  variant?: string | null;
  setPieceCount?: number | null;
  genderConfiguration?: string | null;
  ageGroup?: string | null;
  size?: string | null;
  color?: string | null;
  quantity?: number | null;
};

export type ResearchMarket =
  "BEST_ROUND_SALE" | "SAVED_RESEARCH" | "MEXICO" | "USA";

export type ResearchCandidate = {
  id?: string | null;
  title: string;
  seller: string;
  priceMinor: number;
  /** Always MXN for monetary values used by the engine. */
  currency?: "MXN";
  originalPriceMinor?: number | null;
  originalCurrency?: string | null;
  normalizedPriceMxnMinor?: number | null;
  normalizationSource?: string | null;
  normalizationObservedAt?: string | null;
  market: ResearchMarket;
  source: string;
  url?: string | null;
  condition?: MarketPriceSource["condition"];
  availability?: MarketPriceSource["availability"];
  observedAt: string;
  product?: Partial<ResearchProductInput>;
  similarity?: number;
  similarityReasons?: string[];
  sourceQuality?: number;
  evidenceScore?: number;
  sourceQualityReasons?: string[];
  marketPriorityScore?: number;
  recencyScore?: number;
  productKind?: ComparableProductKind;
  productKindConfidence?: ComparableProductClassification["confidence"];
  productKindReasons?: string[];
  certainty?: ComparableCertainty;
  certaintyReasons?: string[];
  sourceType?:
    | "OFFICIAL_MANUFACTURER"
    | "AUTHORIZED_RETAILER"
    | "SPECIALIST_RETAILER"
    | "MARKETPLACE"
    | "OTHER";
  providerCategory?: string | null;
};

export type ComparableProductKind =
  | "FULL_PRODUCT"
  | "COMPLETE_SET"
  | "IRON_SET"
  | "PARTIAL_SET"
  | "SINGLE_CLUB"
  | "BAG_ONLY"
  | "COMPONENT"
  | "ACCESSORY"
  | "BUNDLE"
  | "UNKNOWN";

export type ComparisonProfileFamily =
  | "CLUB"
  | "SET"
  | "BAG"
  | "APPAREL"
  | "FOOTWEAR"
  | "GLOVE"
  | "HAT"
  | "SOFT_ACCESSORY"
  | "HARD_ACCESSORY"
  | "ELECTRONIC_ACCESSORY"
  | "OTHER_ACCESSORY";

export type ComparableProfile = {
  family: ComparisonProfileFamily;
  productType: string | null;
  requiredDimensions: readonly string[];
  hardDimensions: readonly string[];
  softDimensions: readonly string[];
  irrelevantDimensions: readonly string[];
};

export type ComparableProductClassification = {
  kind: ComparableProductKind;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reasons: string[];
};

export type ComparableCertainty = "EXACT" | "STRONG" | "AMBIGUOUS" | "REJECT";

export type ComparableAmbiguityDecision =
  "SAME_PRODUCT" | "DIFFERENT_PRODUCT" | "INSUFFICIENT_EVIDENCE";

export type ExcludedCandidate = ResearchCandidate & { exclusion: string };

export type EvidenceSufficiency = {
  level: "SUFFICIENT_HIGH" | "SUFFICIENT_MEDIUM" | "INSUFFICIENT";
  reasons: string[];
};

export type ResearchResult = {
  status: "COMPLETE" | "INSUFFICIENT_DATA" | "PROVIDER_UNAVAILABLE";
  evidenceLevel: EvidenceSufficiency["level"];
  confidence: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";
  resolutionSource: ResearchMarket | "NONE";
  acceptedComparables: ResearchCandidate[];
  excludedComparables: ExcludedCandidate[];
  internalSalesUsed: number;
  cachedResearchUsed: boolean;
  mexicoQueriesExecuted: number;
  usaQueriesExecuted: number;
  fingerprint: string;
  inputSnapshot: ResearchProductInput;
  engineVersion: string;
  /** Present on current snapshots; absent on legacy market-price snapshots. */
  currencyNormalizationVersion?: string;
  comparableClassifierVersion?: string;
  expiresAt: string;
  providerUnavailable: boolean;
  reasons: string[];
  rawResultsCount?: number;
  normalizedCandidatesCount?: number;
  classifiedCandidatesCount?: number;
  acceptedComparablesCount?: number;
  excludedComparablesCount?: number;
  deduplicatedCount?: number;
  officialReference?: OfficialBrandReference | null;
};

const STOPWORDS = new Set([
  "the",
  "and",
  "with",
  "for",
  "de",
  "con",
  "en",
  "mx",
]);

function norm(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: unknown): string[] {
  return norm(value)
    .split(/\s+/)
    .filter((token) => token && !STOPWORDS.has(token));
}

function hasToken(value: string, expected: unknown): boolean {
  const haystack = tokens(value);
  const needles = tokens(expected);
  return (
    needles.length > 0 && needles.every((needle) => haystack.includes(needle))
  );
}

function numericMention(
  title: string,
  value: number | string | null | undefined,
): boolean {
  if (value === null || value === undefined || value === "") return true;
  const raw = String(value).replace(".", "\\.");
  return new RegExp(`(?:^|\\s)${raw}(?:$|\\s|°|degree)`, "i").test(norm(title));
}

/** Stable, category-aware identity used for cache reuse (not exact row equality). */
export function buildResearchFingerprint(input: ResearchProductInput): string {
  const family = input.category ?? input.productFamily ?? "other";
  const profile = resolveComparableProfile(input);
  const relevant: Record<string, unknown> = {
    fingerprintVersion:
      profile.family === "CLUB" ||
      profile.family === "BAG" ||
      profile.family === "SET"
        ? RESEARCH_FINGERPRINT_VERSION
        : `${RESEARCH_FINGERPRINT_VERSION}-category-aware`,
    family,
    profileFamily: profile.family,
    productType: profile.productType,
    brand: norm(input.brand),
    model: norm(input.model),
    modelYear: input.modelYear,
    condition: input.condition,
    handedness: norm(input.handedness),
  };
  if (
    family === "club" ||
    ["driver", "fairway_wood", "hybrid", "iron", "wedge", "putter"].includes(
      family,
    )
  ) {
    Object.assign(relevant, {
      clubType: norm(input.clubType),
      clubNumber: norm(input.clubNumber),
      loftDegrees: input.loftDegrees,
      shaftMaterial: norm(input.shaftMaterial),
      shaftFlex: norm(input.shaftFlex),
      setComposition: norm(input.setComposition),
    });
  }
  if (family === "bag") relevant.bagType = norm(input.bagType);
  if (family === "set") relevant.setType = norm(input.setType);
  if (profile.family === "SET")
    Object.assign(relevant, {
      variant: norm(input.variant),
      setPieceCount: input.setPieceCount,
      setComposition: norm(input.setComposition),
      genderConfiguration: norm(input.genderConfiguration),
      ageGroup: norm(input.ageGroup),
    });
  if (
    profile.family !== "CLUB" &&
    profile.family !== "BAG" &&
    profile.family !== "SET"
  )
    Object.assign(relevant, {
      variant: norm(input.variant),
      productType: norm(input.productType),
      genderConfiguration: norm(input.genderConfiguration),
    });
  return createHash("sha256").update(JSON.stringify(relevant)).digest("hex");
}

function categoryOf(input: ResearchProductInput): string {
  return norm(input.clubType ?? input.category ?? input.productFamily);
}

const ACCESSORY_TYPES = new Set([
  "shoe",
  "shoes",
  "golf shoe",
  "footwear",
  "polo",
  "shirt",
  "t shirt",
  "shorts",
  "pants",
  "skirt",
  "jacket",
  "vest",
  "rain jacket",
  "sweater",
  "hoodie",
  "apparel",
  "glove",
  "gloves",
  "hat",
  "cap",
  "visor",
  "belt",
  "sock",
  "socks",
  "towel",
  "umbrella",
  "rangefinder",
  "gps",
  "training aid",
  "headcover",
]);

/** Resolves a comparison profile without introducing a second taxonomy. */
export function resolveComparableProfile(
  input: ResearchProductInput,
): ComparableProfile {
  const explicit = norm(input.researchFamily ?? input.category);
  const type = norm(input.productType ?? input.clubType ?? input.setType);
  if (
    input.productFamily === "set" ||
    explicit === "set" ||
    explicit === "complete set"
  )
    return {
      family: "SET",
      productType: type || "complete_set",
      requiredDimensions: ["brand", "model", "completeSet"],
      hardDimensions: ["composition", "ageGroup"],
      softDimensions: [
        "pieceCount",
        "variant",
        "handedness",
        "genderConfiguration",
        "condition",
      ],
      irrelevantDimensions: ["size", "color"],
    };
  if (input.productFamily === "bag" || explicit === "bag")
    return {
      family: "BAG",
      productType: input.bagType ?? "bag",
      requiredDimensions: ["brand", "model", "productType"],
      hardDimensions: ["productType"],
      softDimensions: ["variant", "condition"],
      irrelevantDimensions: ["size", "color"],
    };
  if (
    input.productFamily === "club" ||
    ["driver", "fairway_wood", "hybrid", "iron", "wedge", "putter"].includes(
      type,
    )
  )
    return {
      family: "CLUB",
      productType: input.clubType,
      requiredDimensions: ["brand", "model", "productType"],
      hardDimensions: ["productKind", "condition", "model"],
      softDimensions: ["handedness", "loft", "flex", "year", "composition"],
      irrelevantDimensions: ["size", "color"],
    };
  if (
    type.includes("shoe") ||
    type.includes("footwear") ||
    explicit.includes("shoe") ||
    explicit === "footwear"
  )
    return {
      family: "FOOTWEAR",
      productType: type || "golf_shoe",
      requiredDimensions: ["brand", "model", "productType"],
      hardDimensions: ["productType", "condition"],
      softDimensions: [
        "size",
        "width",
        "color",
        "genderConfiguration",
        "spiked",
      ],
      irrelevantDimensions: ["handedness", "flex"],
    };
  if (type === "glove" || type === "gloves" || explicit === "glove")
    return {
      family: "GLOVE",
      productType: "glove",
      requiredDimensions: ["brand", "model", "productType"],
      hardDimensions: ["productType", "condition"],
      softDimensions: ["size", "handedness", "color"],
      irrelevantDimensions: ["flex"],
    };
  if (
    [
      "polo",
      "shirt",
      "t shirt",
      "shorts",
      "pants",
      "skirt",
      "jacket",
      "vest",
      "rain jacket",
      "sweater",
      "hoodie",
      "apparel",
    ].includes(type) ||
    explicit === "apparel"
  )
    return {
      family: "APPAREL",
      productType: type || "apparel",
      requiredDimensions: ["brand", "model", "productType"],
      hardDimensions: ["productType", "condition"],
      softDimensions: ["size", "color", "genderConfiguration", "ageGroup"],
      irrelevantDimensions: ["handedness", "flex"],
    };
  if (
    type === "hat" ||
    type === "cap" ||
    type === "visor" ||
    explicit === "hat"
  )
    return {
      family: "HAT",
      productType: type,
      requiredDimensions: ["brand", "productType"],
      hardDimensions: ["productType", "condition"],
      softDimensions: ["size", "color", "model"],
      irrelevantDimensions: ["handedness", "flex"],
    };
  if (["rangefinder", "gps"].includes(type) || explicit.includes("electronic"))
    return {
      family: "ELECTRONIC_ACCESSORY",
      productType: type,
      requiredDimensions: ["brand", "model", "productType"],
      hardDimensions: ["productType", "model", "condition"],
      softDimensions: ["generation", "bundle"],
      irrelevantDimensions: ["size", "color"],
    };
  if (
    ACCESSORY_TYPES.has(type) ||
    explicit.includes("accessory") ||
    explicit.includes("soft")
  )
    return {
      family: "SOFT_ACCESSORY",
      productType: type || "accessory",
      requiredDimensions: ["brand", "productType"],
      hardDimensions: ["productType", "condition"],
      softDimensions: ["model", "size", "color", "quantity"],
      irrelevantDimensions: ["handedness", "flex"],
    };
  return {
    family: "OTHER_ACCESSORY",
    productType: type || null,
    requiredDimensions: ["brand", "productType"],
    hardDimensions: ["condition"],
    softDimensions: ["model"],
    irrelevantDimensions: [],
  };
}

function hand(value: unknown): string {
  const normalized = norm(value);
  return ["right", "rh", "derecho", "derecha"].includes(normalized)
    ? "right"
    : ["left", "lh", "zurdo", "zurda", "izquierdo", "izquierda"].includes(
          normalized,
        )
      ? "left"
      : normalized;
}

const accessoryPattern =
  /\b(weight|weights|sliding weight|replacement weight|peso|pesas?|contrapeso|tornillo|repuesto|reemplazo|accesorio|adaptador|adapter|adaptor|sleeve|funda|cubierta|headcover|cover|llave|wrench|manguito|casquillo|grip|empuñadura|varilla|shaft|eje|tip|ferrule)\b/;

function inferAccessoryType(title: string): string | null {
  const value = norm(title);
  if (/\b(shoe|shoes|golf shoe|footwear)\b/.test(value)) return "shoes";
  if (
    /\b(polo|shirt|t shirt|shorts|pants|skirt|jacket|vest|sweater|hoodie)\b/.test(
      value,
    )
  )
    return "apparel";
  if (/\b(glove|gloves)\b/.test(value)) return "glove";
  if (/\b(cap|hat|visor)\b/.test(value)) return "hat";
  if (/\b(belt|sock|socks|towel|umbrella)\b/.test(value))
    return value.match(/belt|sock|socks|towel|umbrella/)?.[0] ?? "accessory";
  if (/\b(rangefinder|gps)\b/.test(value)) return "rangefinder";
  return null;
}

function sameAccessoryType(target: string, candidate: string): boolean {
  const t = norm(target);
  const c = norm(candidate);
  if (t === c) return true;
  if ((t.includes("shoe") || t === "footwear") && c.includes("shoe"))
    return true;
  if (
    (t.includes("apparel") ||
      [
        "polo",
        "shirt",
        "shorts",
        "pants",
        "skirt",
        "jacket",
        "vest",
        "sweater",
        "hoodie",
      ].includes(t)) &&
    (c.includes("apparel") ||
      [
        "polo",
        "shirt",
        "shorts",
        "pants",
        "skirt",
        "jacket",
        "vest",
        "sweater",
        "hoodie",
      ].includes(c))
  )
    return t === c || t === "apparel" || c === "apparel";
  return false;
}

/** Classifies the object being sold before any brand/model similarity is scored. */
export function classifyComparableProductKind(
  input: ResearchProductInput,
  candidate: ResearchCandidate,
): ComparableProductClassification {
  const title = norm(candidate.title);
  const family = categoryOf(input);
  const profile = resolveComparableProfile(input);
  const reasons: string[] = [];
  const candidateProductType = norm(
    candidate.providerCategory ??
      candidate.product?.productType ??
      candidate.product?.clubType ??
      candidate.product?.setType,
  );
  if (profile.family === "SET") {
    if (
      /\b(iron set|juego de hierros|5 pw|4 pw)\b/.test(title) ||
      candidateProductType === "iron_set"
    )
      return {
        kind: "IRON_SET",
        confidence: "HIGH",
        reasons: ["IRON_SET_NOT_COMPLETE_SET"],
      };
    if (
      /\b(driver|fairway|hybrid|iron|wedge|putter)\b/.test(title) &&
      !/\b(set|juego|complete|package)\b/.test(title)
    )
      return {
        kind: "SINGLE_CLUB",
        confidence: "HIGH",
        reasons: ["SINGLE_CLUB"],
      };
    if (
      /\b(bag|bolsa)\b/.test(title) &&
      !/\b(set|juego|complete|package)\b/.test(title)
    )
      return { kind: "BAG_ONLY", confidence: "HIGH", reasons: ["BAG_ONLY"] };
    if (/\b(partial|half set|medio set|incomplete|incompleto)\b/.test(title))
      return {
        kind: "PARTIAL_SET",
        confidence: "HIGH",
        reasons: ["PARTIAL_SET"],
      };
    if (
      candidateProductType === "complete_set" ||
      /\b(complete|package set|starter set|juego completo|set completo|golf set|club set|\d{1,2}\s*piece)\b/.test(
        title,
      )
    )
      return {
        kind: "COMPLETE_SET",
        confidence: candidateProductType === "complete_set" ? "HIGH" : "MEDIUM",
        reasons: ["COMPLETE_SET_SIGNAL"],
      };
    return {
      kind: "UNKNOWN",
      confidence: "LOW",
      reasons: ["SET_COMPOSITION_UNCONFIRMED"],
    };
  }
  if (profile.family !== "CLUB" && profile.family !== "BAG") {
    const targetType = norm(input.productType ?? input.category);
    if (
      /\b(shoe bag|spike replacement|replacement spikes|protective case|carrying case|phone case)\b/.test(
        title,
      )
    )
      return {
        kind: "ACCESSORY",
        confidence: "HIGH",
        reasons: ["WRONG_PRODUCT_TYPE"],
      };
    const candidateTextType = candidateProductType || inferAccessoryType(title);
    if (
      !candidateTextType ||
      (targetType && !sameAccessoryType(targetType, candidateTextType))
    )
      return {
        kind: "UNKNOWN",
        confidence: "LOW",
        reasons: ["WRONG_PRODUCT_TYPE"],
      };
    if (
      /\b(2|3|4|5)[ -]?(pack|packs|pieza|piezas|piece|pieces)\b|\bpack of [2-9]\b|\b(paquete|juego) de [2-9]\b/.test(
        title,
      )
    )
      return { kind: "BUNDLE", confidence: "HIGH", reasons: ["BUNDLE"] };
    return {
      kind: "ACCESSORY",
      confidence: candidateProductType ? "HIGH" : "MEDIUM",
      reasons: ["ACCESSORY_PRODUCT_SIGNAL"],
    };
  }
  const componentOnly =
    /\b(head only|club head|cabeza sola|shaft only|solo shaft|varilla sola|grip only|solo grip)\b/.test(
      title,
    );
  if (componentOnly) {
    if (/head|cabeza/.test(title)) reasons.push("HEAD_ONLY");
    else if (/grip|empuñadura/.test(title)) reasons.push("GRIP_ONLY");
    else reasons.push("SHAFT_ONLY");
    return { kind: "COMPONENT", confidence: "HIGH", reasons };
  }
  if (
    /\b(bundle|pack|paquete|set de accesorios|kit de accesorios)\b/.test(title)
  )
    return { kind: "BUNDLE", confidence: "HIGH", reasons: ["BUNDLE"] };
  const accessory = accessoryPattern.test(title);
  const compatibilityPhrase =
    /\b(for|para|compatible with|compatible con|replacement|repuesto)\b/.test(
      title,
    );
  const fullProductWithComponent =
    /\b(driver|fairway|wood|hybrid|iron|wedge|putter)\b.*\b(with|con|incluye)\b.*\b(shaft|varilla|grip|empuñadura)\b/.test(
      title,
    );
  if (fullProductWithComponent)
    return {
      kind: "FULL_PRODUCT",
      confidence: "HIGH",
      reasons: ["COMPLETE_CLUB_SIGNAL"],
    };
  if (accessory && compatibilityPhrase) {
    if (/weight|peso|pesa|contrapeso/.test(title)) reasons.push("WEIGHT_ONLY");
    else if (/adapter|adaptador|sleeve|manguito|casquillo/.test(title))
      reasons.push("ADAPTER_ONLY");
    else if (/headcover|cover|funda|cubierta/.test(title))
      reasons.push("HEADCOVER_ONLY");
    else if (/shaft|varilla|eje/.test(title)) reasons.push("SHAFT_ONLY");
    else reasons.push("ACCESSORY_ONLY");
    return { kind: "ACCESSORY", confidence: "HIGH", reasons };
  }
  if (
    accessory &&
    (/^(?:golf )?(?:weight|weights|peso|pesas?|contrapeso)\b/.test(title) ||
      /^(?:nuevo )?(?:titleist|callaway|taylormade|ping)\b/.test(title))
  ) {
    const reason = /weight|peso|pesa|contrapeso/.test(title)
      ? "WEIGHT_ONLY"
      : "REPLACEMENT_PART";
    return { kind: "COMPONENT", confidence: "MEDIUM", reasons: [reason] };
  }
  const isClub = [
    "driver",
    "fairway_wood",
    "hybrid",
    "iron",
    "wedge",
    "putter",
  ].includes(family);
  if (isClub) {
    const clubWord =
      family === "fairway_wood"
        ? /\b(fairway|wood|madera)\b/
        : new RegExp(`\\b${family.replace("_", " ")}\\b`);
    if (clubWord.test(title) && !accessory) {
      if (
        family === "iron" &&
        /\b(7|8|9)\s*iron\b/.test(title) &&
        !/\b(set|juego|pw|4-pw|5-pw)\b/.test(title)
      )
        return {
          kind: "FULL_PRODUCT",
          confidence: "HIGH",
          reasons: ["INDIVIDUAL_IRON"],
        };
      return {
        kind: "FULL_PRODUCT",
        confidence: "HIGH",
        reasons: ["COMPLETE_CLUB_SIGNAL"],
      };
    }
    return {
      kind: "UNKNOWN",
      confidence: "LOW",
      reasons: ["PRODUCT_KIND_UNCERTAIN"],
    };
  }
  if (family === "bag") {
    if (/\b(bag|golf bag|stand bag|cart bag|bolsa)\b/.test(title) && !accessory)
      return {
        kind: "FULL_PRODUCT",
        confidence: "HIGH",
        reasons: ["COMPLETE_BAG_SIGNAL"],
      };
    return {
      kind: "UNKNOWN",
      confidence: "LOW",
      reasons: ["PRODUCT_KIND_UNCERTAIN"],
    };
  }
  if (family === "set") {
    if (/\b(set|juego|combo|kit)\b/.test(title) && !accessory)
      return {
        kind: "FULL_PRODUCT",
        confidence: "HIGH",
        reasons: ["COMPLETE_SET_SIGNAL"],
      };
    return {
      kind: "UNKNOWN",
      confidence: "LOW",
      reasons: ["PRODUCT_KIND_UNCERTAIN"],
    };
  }
  return accessory
    ? { kind: "ACCESSORY", confidence: "MEDIUM", reasons: ["ACCESSORY_ONLY"] }
    : {
        kind: "UNKNOWN",
        confidence: "LOW",
        reasons: ["PRODUCT_KIND_UNCERTAIN"],
      };
}

/** Certainty is deliberately separate from numeric similarity. */
export function classifyComparableCertainty(
  input: ResearchProductInput,
  candidate: ResearchCandidate,
  classification = classifyComparableProductKind(input, candidate),
): { certainty: ComparableCertainty; reasons: string[] } {
  const profile = resolveComparableProfile(input);
  const compatibleKind =
    (profile.family === "SET" && classification.kind === "COMPLETE_SET") ||
    (profile.family === "CLUB" && classification.kind === "FULL_PRODUCT") ||
    (profile.family === "BAG" && classification.kind === "FULL_PRODUCT") ||
    (profile.family !== "SET" &&
      profile.family !== "CLUB" &&
      profile.family !== "BAG" &&
      classification.kind === "ACCESSORY");
  if (!compatibleKind)
    return { certainty: "REJECT", reasons: classification.reasons };
  const title = norm(candidate.title);
  const product = candidate.product ?? {};
  const structuredType = norm(
    candidate.providerCategory ?? product.clubType ?? product.category,
  );
  const sourceType = candidate.sourceType;
  const trustedSource =
    Boolean(
      sourceType && sourceType !== "MARKETPLACE" && sourceType !== "OTHER",
    ) ||
    /best round|golf galaxy|pga|proshop|golfsmith|2nd swing|club champion/.test(
      norm(candidate.seller),
    );
  if (
    /tour inspired|low spin adjustable performance|golf driver\b/.test(title) &&
    !structuredType &&
    !trustedSource
  )
    return {
      certainty: "AMBIGUOUS",
      reasons: ["PRODUCT_IDENTITY_UNCONFIRMED"],
    };
  const brand = input.brand ? hasToken(title, input.brand) : true;
  const model = input.model ? hasToken(title, input.model) : true;
  if (!brand || !model)
    return {
      certainty: "REJECT",
      reasons: [brand ? "WRONG_MODEL" : "WRONG_BRAND"],
    };
  const hasConfiguration =
    Boolean(
      product.clubType ||
      product.productType ||
      product.category ||
      candidate.providerCategory,
    ) ||
    /\b(driver|fairway|wood|hybrid|iron|wedge|putter|bag|golf club|complete|package set|polo|shirt|shoe|glove|cap|hat|rangefinder)\b/.test(
      title,
    );
  if (!hasConfiguration)
    return {
      certainty: "AMBIGUOUS",
      reasons: ["PRODUCT_IDENTITY_UNCONFIRMED"],
    };
  const explicitIdentity =
    Boolean(
      candidate.product &&
      (candidate.product.clubType || candidate.product.category),
    ) ||
    /\b(driver|fairway|hybrid|wedge|putter|complete|package set|polo|shirt|shoe|glove|cap|hat|rangefinder)\b/.test(
      title,
    );
  return {
    certainty: explicitIdentity ? "STRONG" : "AMBIGUOUS",
    reasons: explicitIdentity
      ? ["IDENTITY_CONFIRMED"]
      : ["PRODUCT_IDENTITY_UNCONFIRMED"],
  };
}

/** Rules-first similarity score. Missing attributes never manufacture a mismatch. */
export function scoreResearchSimilarity(
  input: ResearchProductInput,
  candidate: ResearchCandidate,
): {
  score: number;
  reasons: string[];
  hardMismatch: boolean;
} {
  const title = norm(candidate.title);
  const product = {
    ...inferProductHints(candidate.title),
    ...(candidate.product ?? {}),
  };
  const reasons: string[] = [];
  if (input.brand && !hasToken(title, input.brand))
    return { score: 0, reasons: ["WRONG_BRAND"], hardMismatch: true };
  if (input.model && !hasToken(title, input.model))
    return { score: 0, reasons: ["WRONG_MODEL"], hardMismatch: true };
  const family = categoryOf(input);
  const profile = resolveComparableProfile(input);
  const candidateFamily = norm(
    String(product.clubType ?? product.category ?? ""),
  );
  const classification = classifyComparableProductKind(input, candidate);
  const targetKind = categoryOf(input);
  if (
    [
      "driver",
      "fairway_wood",
      "hybrid",
      "iron",
      "wedge",
      "putter",
      "bag",
      "set",
    ].includes(targetKind) &&
    classification.kind !== "FULL_PRODUCT" &&
    !(profile.family === "SET" && classification.kind === "COMPLETE_SET")
  ) {
    return {
      score: 0,
      reasons: classification.reasons,
      hardMismatch: true,
    };
  }
  if (profile.family === "SET" && classification.kind !== "COMPLETE_SET")
    return { score: 0, reasons: classification.reasons, hardMismatch: true };
  if (profile.family === "SET") {
    const age = norm(input.ageGroup ?? input.targetPlayer);
    if (age && /\b(junior|youth|kids|junior)\b/.test(title) && age !== "junior")
      return {
        score: 0,
        reasons: ["ADULT_JUNIOR_MISMATCH"],
        hardMismatch: true,
      };
    if (age === "junior" && /\b(mens|men|womens|women|adult)\b/.test(title))
      return {
        score: 0,
        reasons: ["ADULT_JUNIOR_MISMATCH"],
        hardMismatch: true,
      };
    const gender = norm(input.genderConfiguration ?? input.targetPlayer);
    if (gender === "men" && /\b(womens|women|ladies)\b/.test(title))
      return {
        score: 0,
        reasons: ["SET_CONFIGURATION_MISMATCH"],
        hardMismatch: true,
      };
    if (gender === "women" && /\b(mens|men)\b/.test(title))
      return {
        score: 0,
        reasons: ["SET_CONFIGURATION_MISMATCH"],
        hardMismatch: true,
      };
  }
  if (
    profile.family !== "CLUB" &&
    profile.family !== "BAG" &&
    profile.family !== "SET"
  ) {
    if (classification.kind !== "ACCESSORY")
      return { score: 0, reasons: classification.reasons, hardMismatch: true };
    if (classification.reasons.includes("WRONG_PRODUCT_TYPE"))
      return { score: 0, reasons: classification.reasons, hardMismatch: true };
    const targetType = norm(input.productType ?? input.category);
    const candidateType = norm(
      product.productType ?? product.category ?? product.clubType,
    );
    if (
      targetType &&
      candidateType &&
      !sameAccessoryType(targetType, candidateType)
    )
      return { score: 0, reasons: ["WRONG_PRODUCT_TYPE"], hardMismatch: true };
  }
  if (
    family &&
    candidateFamily &&
    family !== candidateFamily &&
    !title.includes(family)
  ) {
    return { score: 0, reasons: ["WRONG_CATEGORY"], hardMismatch: true };
  }
  if (
    input.handedness &&
    product.handedness &&
    hand(input.handedness) !== hand(product.handedness)
  ) {
    reasons.push("HAND_MISMATCH");
  }
  let score = 45;
  if (input.brand) score += 15;
  if (input.model) score += 15;
  if (reasons.includes("HAND_MISMATCH"))
    score -= input.condition === "used" ? 12 : 7;
  if (
    input.condition === candidate.condition ||
    candidate.condition === "unknown"
  )
    score += 8;
  else if (input.condition === "new" && candidate.condition === "used")
    return { score: 0, reasons: ["CONDITION_MISMATCH"], hardMismatch: true };
  if (input.modelYear !== null && input.modelYear !== undefined)
    score += numericMention(title, input.modelYear) ? 5 : 2;
  if (family !== "putter" && input.shaftFlex)
    score += product.shaftFlex
      ? norm(input.shaftFlex) === norm(product.shaftFlex)
        ? 5
        : 1
      : hasToken(title, input.shaftFlex)
        ? 5
        : 1;
  if (
    ["driver", "fairway wood", "fairway_wood", "hybrid", "wedge"].includes(
      family,
    )
  ) {
    if (input.loftDegrees !== null && input.loftDegrees !== undefined)
      score +=
        product.loftDegrees !== null && product.loftDegrees !== undefined
          ? Number(product.loftDegrees) === input.loftDegrees
            ? 5
            : Math.abs(Number(product.loftDegrees) - input.loftDegrees) <= 2
              ? 2
              : 0
          : numericMention(title, input.loftDegrees)
            ? 5
            : 2;
    if (input.clubNumber)
      score += product.clubNumber
        ? norm(input.clubNumber) === norm(product.clubNumber)
          ? 3
          : 0
        : hasToken(title, input.clubNumber)
          ? 3
          : 1;
  }
  if (family === "iron" && input.setComposition)
    score += hasToken(title, input.setComposition) ? 5 : 2;
  if (family === "bag" && input.bagType)
    score += hasToken(title, input.bagType) ? 8 : 2;
  return { score: Math.min(100, score), reasons, hardMismatch: false };
}

export function evaluateEvidenceSufficiency(
  candidates: readonly ResearchCandidate[],
): EvidenceSufficiency {
  const internal = candidates.filter((c) => c.market === "BEST_ROUND_SALE");
  const strongInternal = internal.filter(
    (c) => (c.similarity ?? 0) >= 90,
  ).length;
  const adequateInternal = internal.filter(
    (c) => (c.similarity ?? 0) >= 75,
  ).length;
  if (strongInternal >= 3)
    return {
      level: "SUFFICIENT_HIGH",
      reasons: ["THREE_STRONG_INTERNAL_SALES"],
    };
  if (adequateInternal >= 5)
    return {
      level: "SUFFICIENT_HIGH",
      reasons: ["FIVE_COMPATIBLE_INTERNAL_SALES"],
    };
  const strong = candidates.filter((c) => (c.similarity ?? 0) >= 75);
  const markets = new Set(strong.map((c) => c.market));
  const averageEvidence = strong.length
    ? strong.reduce(
        (sum, candidate) =>
          sum + (candidate.evidenceScore ?? candidate.similarity ?? 0),
        0,
      ) / strong.length
    : 0;
  if (strong.length >= 5 && averageEvidence >= 65 && markets.size >= 1)
    return {
      level: "SUFFICIENT_MEDIUM",
      reasons: ["FIVE_COMPATIBLE_COMPARABLES"],
    };
  if (strong.length >= 3 && averageEvidence >= 65)
    return {
      level: "SUFFICIENT_MEDIUM",
      reasons: ["THREE_GOOD_COMPATIBLE_COMPARABLES"],
    };
  return {
    level: "INSUFFICIENT",
    reasons: ["MORE_COMPATIBLE_EVIDENCE_REQUIRED"],
  };
}

function sourceQualityDetail(
  candidate: ResearchCandidate,
  reliability?: Readonly<Record<string, number>>,
): {
  score: number;
  reasons: string[];
} {
  const seller = norm(candidate.seller);
  if (candidate.market === "BEST_ROUND_SALE")
    return { score: 100, reasons: ["BEST_ROUND_COMPLETED_SALE"] };
  const observed = reliability?.[candidate.source];
  const adjust = (base: number) =>
    observed === undefined
      ? { score: base, reasons: ["BASE_SOURCE_QUALITY"] }
      : {
          score: Math.max(
            0,
            Math.min(100, Math.round(base * 0.7 + observed * 0.3)),
          ),
          reasons: ["BASE_SOURCE_QUALITY", "LEARNED_SOURCE_RELIABILITY"],
        };
  if (/golf|proshop|golf galaxy|pga/.test(seller)) return adjust(85);
  if (seller && seller !== "unknown") return adjust(65);
  return adjust(45);
}

function marketPriority(candidate: ResearchCandidate): number {
  return candidate.market === "BEST_ROUND_SALE"
    ? 100
    : candidate.market === "SAVED_RESEARCH"
      ? 90
      : candidate.market === "MEXICO"
        ? 80
        : 55;
}

function recency(candidate: ResearchCandidate, now: Date): number {
  const days = Math.max(
    0,
    (now.getTime() - Date.parse(candidate.observedAt)) / 86_400_000,
  );
  if (!Number.isFinite(days)) return 40;
  if (days <= 30) return 100;
  if (days <= 60) return 90;
  if (days <= 90) return 80;
  return candidate.market === "BEST_ROUND_SALE"
    ? Math.max(50, 80 - Math.floor(days / 30))
    : 0;
}

function dedupeKey(candidate: ResearchCandidate): string {
  return (
    norm(candidate.url) ||
    [norm(candidate.seller), norm(candidate.title), candidate.priceMinor].join(
      "|",
    )
  );
}

function queryPlan(input: ResearchProductInput, market: "MX" | "US"): string[] {
  const prefix = [input.brand, input.model].filter(Boolean).join(" ");
  const profile = resolveComparableProfile(input);
  const type =
    profile.family === "SET"
      ? "complete golf set"
      : (input.productType ??
        input.clubType ??
        input.bagType ??
        input.setType ??
        input.productFamily);
  const queries = [
    prefix,
    [prefix, type].filter(Boolean).join(" "),
    [prefix, input.loftDegrees ? `${input.loftDegrees}°` : input.clubNumber]
      .filter(Boolean)
      .join(" "),
    profile.family === "SET" && input.setPieceCount
      ? `${prefix} complete set ${input.setPieceCount} piece`
      : [prefix, type, "complete"].filter(Boolean).join(" "),
  ];
  return queries
    .map((query) => `${query} ${market === "MX" ? "México" : "USA"}`.trim())
    .filter((query, index, all) => query && all.indexOf(query) === index)
    .slice(0, market === "MX" ? 5 : 3);
}

export type ResearchDependencies = {
  provider: MarketPriceProvider;
  internalSales?: readonly ResearchCandidate[];
  savedResearch?: readonly ResearchCandidate[];
  now?: Date;
  forceRefresh?: boolean;
  maxMexicoQueries?: number;
  maxUsaQueries?: number;
  sourceReliability?: Readonly<Record<string, number>>;
  ambiguityResolver?: ComparableAmbiguityResolver;
  maxAmbiguityCalls?: number;
  officialReferenceResolver?: import("@/lib/pricing/official-brand-reference").OfficialBrandReferenceResolver;
};

function externalCandidates(
  result: MarketPriceResult,
  market: ResearchMarket,
): ResearchCandidate[] {
  return (Array.isArray(result.sources) ? result.sources : []).map(
    (source) => ({
      title: source.productName,
      seller: source.merchant,
      priceMinor: source.priceMxn,
      currency: "MXN",
      originalPriceMinor: source.originalPriceMinor ?? null,
      originalCurrency: source.originalCurrency,
      normalizedPriceMxnMinor: source.priceMxn,
      normalizationSource: source.normalizationSource ?? null,
      normalizationObservedAt: source.normalizationObservedAt ?? null,
      market,
      source: result.provider,
      url: source.url,
      condition: source.condition,
      availability: source.availability,
      observedAt: source.checkedAt,
      product: inferProductHints(source.productName),
      sourceType: source.sourceType,
      providerCategory: source.providerCategory,
    }),
  );
}

function inferProductHints(title: string): Partial<ResearchProductInput> {
  const value = norm(title);
  const flex =
    /\b(x stiff|extra stiff|x-stiff|stiff|s-flex|regular|reg|r-flex|senior|ladies|a-flex|l-flex)\b/.exec(
      value,
    )?.[1] ?? null;
  const clubType =
    /\b(driver|fairway wood|wood|hybrid|iron|wedge|putter)\b/.exec(
      value,
    )?.[1] ?? null;
  const loft = /\b(\d{1,2}(?:\.\d)?)\s*(?:degree|degrees|deg|°)\b/.exec(
    value,
  )?.[1];
  const clubNumber =
    /\b([3-9])\s*(?:wood|iron|hybrid)\b/.exec(value)?.[1] ?? null;
  const handedness =
    /\b(left|lh|left hand|zurdo|zurda|izquierdo|izquierda|right|rh|right hand|diestro|diestra|derecho|derecha)\b/.exec(
      value,
    )?.[1] ?? null;
  return {
    clubType: clubType === "wood" ? "fairway_wood" : clubType,
    loftDegrees: loft ? Number(loft) : null,
    clubNumber,
    handedness,
    shaftFlex: flex,
  };
}

function inferCondition(title: string): MarketPriceSource["condition"] {
  const value = norm(title);
  if (/\b(refurbished|reacondicionado|renewed)\b/.test(value)) return "used";
  if (
    /\b(used|pre owned|preowned|pre-owned|usado|seminuevo|second hand|segunda mano)\b/.test(
      value,
    )
  )
    return "used";
  if (/\b(new|nuevo|brand new|nuevo en caja|new club)\b/.test(value))
    return "new";
  return "unknown";
}

export async function researchBestRoundIntelligence(
  input: ResearchProductInput,
  deps: ResearchDependencies,
): Promise<ResearchResult> {
  const now = deps.now ?? new Date();
  const fingerprint = buildResearchFingerprint(input);
  const freshSavedResearch = (deps.savedResearch ?? []).filter((candidate) => {
    if (deps.forceRefresh) return false;
    const observed = Date.parse(candidate.observedAt);
    return (
      Number.isFinite(observed) &&
      now.getTime() - observed <= RESEARCH_TTL_DAYS * 86_400_000
    );
  });
  const accepted: ResearchCandidate[] = [];
  const excluded: ExcludedCandidate[] = [];
  let classifiedCandidatesCount = 0;
  let deduplicatedCount = 0;
  let ambiguityCalls = 0;
  const add = async (candidate: ResearchCandidate) => {
    classifiedCandidatesCount += 1;
    const candidateCondition =
      candidate.condition && candidate.condition !== "unknown"
        ? candidate.condition
        : inferCondition(candidate.title);
    if (input.condition === "new" && candidateCondition !== "new")
      return excluded.push({
        ...candidate,
        condition: candidateCondition,
        exclusion:
          candidateCondition === "used"
            ? "USED_FOR_NEW_TARGET"
            : "CONDITION_NOT_CONFIRMED",
      });
    if (input.condition === "used" && candidateCondition === "new")
      return excluded.push({
        ...candidate,
        condition: candidateCondition,
        exclusion: "NEW_FOR_USED_MARKET",
      });
    if (candidate.availability === "out_of_stock")
      return excluded.push({ ...candidate, exclusion: "OUT_OF_STOCK" });
    const title = norm(candidate.title);
    if (
      /\b(head only|cabeza sola|shaft only|solo shaft|varilla sola)\b/.test(
        title,
      )
    )
      return excluded.push({
        ...candidate,
        exclusion: /shaft|varilla/.test(title) ? "SHAFT_ONLY" : "HEAD_ONLY",
      });
    if (/\bcoupon|promo code|codigo promocional|cupon\b/.test(title))
      return excluded.push({ ...candidate, exclusion: "COUPON_PRICE" });
    if (
      /\bbundle|pack|set de|paquete\b/.test(title) &&
      categoryOf(input) !== "set"
    )
      return excluded.push({ ...candidate, exclusion: "BUNDLE" });
    if (/\bauction|subasta\b/.test(title))
      return excluded.push({ ...candidate, exclusion: "AUCTION_UNRESOLVED" });
    const classified = classifyComparableProductKind(input, {
      ...candidate,
      condition: candidateCondition,
    });
    const certaintyResult = classifyComparableCertainty(
      input,
      { ...candidate, condition: candidateCondition },
      classified,
    );
    if (certaintyResult.certainty === "REJECT")
      return excluded.push({
        ...candidate,
        condition: candidateCondition,
        productKind: classified.kind,
        productKindConfidence: classified.confidence,
        productKindReasons: classified.reasons,
        certainty: certaintyResult.certainty,
        certaintyReasons: certaintyResult.reasons,
        exclusion: certaintyResult.reasons[0] ?? "PRODUCT_IDENTITY_UNCONFIRMED",
      });
    let certainty: ComparableCertainty = certaintyResult.certainty;
    let certaintyReasons = certaintyResult.reasons;
    if (
      certainty === "AMBIGUOUS" &&
      deps.ambiguityResolver &&
      ambiguityCalls < (deps.maxAmbiguityCalls ?? 3)
    ) {
      ambiguityCalls += 1;
      try {
        const resolved = await deps.ambiguityResolver.resolve(
          { ...candidate, condition: candidateCondition },
          input,
        );
        if (resolved.decision === "SAME_PRODUCT") {
          certainty = "STRONG";
          certaintyReasons = [
            "AI_IDENTITY_CONFIRMED",
            ...(resolved.reasons ?? []),
          ];
        } else {
          certainty = "REJECT";
          certaintyReasons = [
            resolved.decision === "DIFFERENT_PRODUCT"
              ? "DIFFERENT_PRODUCT"
              : "PRODUCT_IDENTITY_UNCONFIRMED",
            ...(resolved.reasons ?? []),
          ];
        }
      } catch {
        certainty = "REJECT";
        certaintyReasons = ["PRODUCT_IDENTITY_UNCONFIRMED"];
      }
    }
    if (certainty === "AMBIGUOUS" || certainty === "REJECT")
      return excluded.push({
        ...candidate,
        condition: candidateCondition,
        productKind: classified.kind,
        productKindConfidence: classified.confidence,
        productKindReasons: classified.reasons,
        certainty,
        certaintyReasons,
        exclusion: certaintyReasons[0] ?? "PRODUCT_IDENTITY_UNCONFIRMED",
      });
    const match = scoreResearchSimilarity(input, {
      ...candidate,
      condition: candidateCondition,
    });
    if (match.hardMismatch || match.score < 55)
      return excluded.push({
        ...candidate,
        condition: candidateCondition,
        productKind: classified.kind,
        productKindConfidence: classified.confidence,
        productKindReasons: classified.reasons,
        certainty,
        certaintyReasons,
        similarity: match.score,
        similarityReasons: match.reasons,
        exclusion: match.reasons[0] ?? "LOW_SIMILARITY",
      });
    const key = dedupeKey(candidate);
    if (accepted.some((item) => dedupeKey(item) === key)) {
      deduplicatedCount += 1;
      return excluded.push({ ...candidate, exclusion: "DUPLICATE" });
    }
    const qualityDetail = sourceQualityDetail(
      candidate,
      deps.sourceReliability,
    );
    const priority = marketPriority(candidate);
    const freshness = recency(candidate, now);
    accepted.push({
      ...candidate,
      condition: candidateCondition,
      productKind: classified.kind,
      productKindConfidence: classified.confidence,
      productKindReasons: classified.reasons,
      certainty,
      certaintyReasons,
      similarity: match.score,
      similarityReasons: match.reasons,
      sourceQuality: qualityDetail.score,
      sourceQualityReasons: qualityDetail.reasons,
      marketPriorityScore: priority,
      recencyScore: freshness,
      evidenceScore: Math.round(
        match.score * 0.45 +
          qualityDetail.score * 0.2 +
          priority * 0.2 +
          freshness * 0.15,
      ),
    });
  };
  for (const candidate of [
    ...(deps.internalSales ?? []),
    ...freshSavedResearch,
  ])
    await add(candidate);
  let sufficiency = evaluateEvidenceSufficiency(accepted);
  let mexicoQueriesExecuted = 0;
  let usaQueriesExecuted = 0;
  let rawResultsCount = 0;
  let normalizedCandidatesCount = 0;
  let providerUnavailable = false;
  const marketInput: MarketPriceInput = input;
  const runQueries = async (market: "MX" | "US", max: number) => {
    for (const query of queryPlan(input, market).slice(0, max)) {
      if (evaluateEvidenceSufficiency(accepted).level !== "INSUFFICIENT") break;
      try {
        const result = await deps.provider.getMarketPrice(marketInput, {
          forceRefresh: deps.forceRefresh,
          query,
          market,
        });
        const normalized = externalCandidates(
          result,
          market === "MX" ? "MEXICO" : "USA",
        );
        rawResultsCount += Array.isArray(result.sources)
          ? result.sources.length
          : 0;
        normalizedCandidatesCount += normalized.length;
        for (const candidate of normalized) await add(candidate);
      } catch {
        providerUnavailable = true;
      }
      if (market === "MX") mexicoQueriesExecuted += 1;
      else usaQueriesExecuted += 1;
    }
  };
  if (sufficiency.level === "INSUFFICIENT")
    await runQueries("MX", deps.maxMexicoQueries ?? 5);
  sufficiency = evaluateEvidenceSufficiency(accepted);
  if (sufficiency.level === "INSUFFICIENT")
    await runQueries("US", deps.maxUsaQueries ?? 3);
  sufficiency = evaluateEvidenceSufficiency(accepted);
  const byPriority = [
    "BEST_ROUND_SALE",
    "SAVED_RESEARCH",
    "MEXICO",
    "USA",
  ] as const;
  const resolutionSource =
    byPriority.find((market) =>
      accepted.some((candidate) => candidate.market === market),
    ) ?? "NONE";
  const max = accepted
    .slice()
    .sort((a, b) => (b.evidenceScore ?? 0) - (a.evidenceScore ?? 0))
    .slice(0, 10);
  return {
    status: max.length
      ? "COMPLETE"
      : providerUnavailable
        ? "PROVIDER_UNAVAILABLE"
        : "INSUFFICIENT_DATA",
    evidenceLevel: sufficiency.level,
    confidence:
      sufficiency.level === "SUFFICIENT_HIGH"
        ? "HIGH"
        : sufficiency.level === "SUFFICIENT_MEDIUM"
          ? "MEDIUM"
          : max.length
            ? "LOW"
            : "INSUFFICIENT",
    resolutionSource,
    acceptedComparables: max,
    excludedComparables: excluded,
    internalSalesUsed: accepted.filter(
      (candidate) => candidate.market === "BEST_ROUND_SALE",
    ).length,
    cachedResearchUsed: freshSavedResearch.length > 0,
    mexicoQueriesExecuted,
    usaQueriesExecuted,
    fingerprint,
    inputSnapshot: input,
    engineVersion: INTELLIGENCE_ENGINE_VERSION,
    currencyNormalizationVersion: CURRENCY_NORMALIZATION_VERSION,
    comparableClassifierVersion: COMPARABLE_CLASSIFIER_VERSION,
    expiresAt: new Date(
      now.getTime() + RESEARCH_TTL_DAYS * 86_400_000,
    ).toISOString(),
    providerUnavailable,
    reasons: sufficiency.reasons,
    rawResultsCount,
    normalizedCandidatesCount,
    classifiedCandidatesCount,
    acceptedComparablesCount: max.length,
    excludedComparablesCount: excluded.length,
    deduplicatedCount,
    officialReference:
      input.condition === "new" && deps.officialReferenceResolver
        ? await deps.officialReferenceResolver.resolve({
            brand: input.brand,
            model: input.model,
            market: "MX",
          })
        : null,
  };
}

export interface ComparableAmbiguityResolver {
  resolve(
    candidate: ResearchCandidate,
    input: ResearchProductInput,
  ): Promise<{
    decision: ComparableAmbiguityDecision;
    confidence?: "HIGH" | "MEDIUM" | "LOW";
    reasons?: string[];
    accepted?: boolean;
    reason?: string;
  }>;
}

export class RulesOnlyAmbiguityResolver implements ComparableAmbiguityResolver {
  async resolve(
    candidate: ResearchCandidate,
    input: ResearchProductInput,
  ): Promise<{
    decision: ComparableAmbiguityDecision;
    reasons: string[];
  }> {
    const result = scoreResearchSimilarity(input, candidate);
    return {
      decision:
        !result.hardMismatch && result.score >= 55
          ? result.score >= 75
            ? "SAME_PRODUCT"
            : "INSUFFICIENT_EVIDENCE"
          : "DIFFERENT_PRODUCT",
      reasons: result.reasons,
    };
  }
}

/** Optional AI bridge. The caller owns provider configuration and receives only market metadata. */
export class AiComparableAmbiguityResolver implements ComparableAmbiguityResolver {
  constructor(
    private readonly resolver: (payload: {
      target: Pick<
        ResearchProductInput,
        | "brand"
        | "model"
        | "clubType"
        | "condition"
        | "loftDegrees"
        | "handedness"
        | "shaftFlex"
      >;
      candidate: Pick<
        ResearchCandidate,
        | "title"
        | "seller"
        | "market"
        | "condition"
        | "sourceType"
        | "providerCategory"
      >;
    }) => Promise<{
      decision: ComparableAmbiguityDecision;
      confidence?: "HIGH" | "MEDIUM" | "LOW";
      reasons?: string[];
    }>,
  ) {}

  async resolve(candidate: ResearchCandidate, input: ResearchProductInput) {
    return this.resolver({
      target: {
        brand: input.brand,
        model: input.model,
        clubType: input.clubType,
        condition: input.condition,
        loftDegrees: input.loftDegrees,
        handedness: input.handedness,
        shaftFlex: input.shaftFlex,
      },
      candidate: {
        title: candidate.title,
        seller: candidate.seller,
        market: candidate.market,
        condition: candidate.condition,
        sourceType: candidate.sourceType,
        providerCategory: candidate.providerCategory,
      },
    });
  }
}
