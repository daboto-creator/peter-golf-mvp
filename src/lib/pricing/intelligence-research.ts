import { createHash } from "node:crypto";

import type {
  MarketPriceInput,
  MarketPriceProvider,
  MarketPriceResult,
  MarketPriceSource,
} from "@/lib/pricing/market-price-provider";

export const INTELLIGENCE_ENGINE_VERSION = "best-round-intelligence-v1";
export const RESEARCH_FINGERPRINT_VERSION = "v1";
export const CURRENCY_NORMALIZATION_VERSION = "mxn-minor-v1";
export const COMPARABLE_CLASSIFIER_VERSION = "product-kind-v2";
export const RESEARCH_TTL_DAYS = 90;

export type ResearchProductInput = MarketPriceInput & {
  category?: string | null;
  bounceDegrees?: number | null;
  grind?: string | null;
  putterStyle?: string | null;
  setComposition?: string | null;
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
};

export type ComparableProductKind =
  "FULL_PRODUCT" | "COMPONENT" | "ACCESSORY" | "BUNDLE" | "UNKNOWN";

export type ComparableProductClassification = {
  kind: ComparableProductKind;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reasons: string[];
};

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
  const relevant: Record<string, unknown> = {
    fingerprintVersion: RESEARCH_FINGERPRINT_VERSION,
    family,
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
  return createHash("sha256").update(JSON.stringify(relevant)).digest("hex");
}

function categoryOf(input: ResearchProductInput): string {
  return norm(input.clubType ?? input.category ?? input.productFamily);
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

/** Classifies the object being sold before any brand/model similarity is scored. */
export function classifyComparableProductKind(
  input: ResearchProductInput,
  candidate: ResearchCandidate,
): ComparableProductClassification {
  const title = norm(candidate.title);
  const family = categoryOf(input);
  const reasons: string[] = [];
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
    classification.kind !== "FULL_PRODUCT"
  ) {
    return {
      score: 0,
      reasons: classification.reasons,
      hardMismatch: true,
    };
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
    return { score: 0, reasons: ["WRONG_HAND"], hardMismatch: true };
  }
  let score = 45;
  if (input.brand) score += 15;
  if (input.model) score += 15;
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
  const type =
    input.clubType ?? input.bagType ?? input.setType ?? input.productFamily;
  const queries = [
    prefix,
    [prefix, type].filter(Boolean).join(" "),
    [prefix, input.loftDegrees ? `${input.loftDegrees}°` : input.clubNumber]
      .filter(Boolean)
      .join(" "),
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
  const add = (candidate: ResearchCandidate) => {
    classifiedCandidatesCount += 1;
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
    const match = scoreResearchSimilarity(input, candidate);
    if (match.hardMismatch || match.score < 55)
      return excluded.push({
        ...candidate,
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
    add(candidate);
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
        for (const candidate of normalized) add(candidate);
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
  };
}

export interface ComparableAmbiguityResolver {
  resolve(
    candidate: ResearchCandidate,
    input: ResearchProductInput,
  ): Promise<{ accepted: boolean; reason?: string }>;
}

export class RulesOnlyAmbiguityResolver implements ComparableAmbiguityResolver {
  async resolve(candidate: ResearchCandidate, input: ResearchProductInput) {
    const result = scoreResearchSimilarity(input, candidate);
    return {
      accepted: !result.hardMismatch && result.score >= 55,
      reason: result.reasons[0],
    };
  }
}
