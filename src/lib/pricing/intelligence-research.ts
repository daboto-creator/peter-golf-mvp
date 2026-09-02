import { createHash } from "node:crypto";

import type {
  MarketPriceInput,
  MarketPriceProvider,
  MarketPriceResult,
  MarketPriceSource,
} from "@/lib/pricing/market-price-provider";

export const INTELLIGENCE_ENGINE_VERSION = "best-round-intelligence-v1";
export const RESEARCH_FINGERPRINT_VERSION = "v1";
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
  currency?: string;
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
  expiresAt: string;
  providerUnavailable: boolean;
  reasons: string[];
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
  const product = candidate.product ?? {};
  const reasons: string[] = [];
  if (input.brand && !hasToken(title, input.brand))
    return { score: 0, reasons: ["WRONG_BRAND"], hardMismatch: true };
  if (input.model && !hasToken(title, input.model))
    return { score: 0, reasons: ["WRONG_MODEL"], hardMismatch: true };
  const family = categoryOf(input);
  const candidateFamily = norm(
    String(product.clubType ?? product.category ?? ""),
  );
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
    norm(input.handedness) !== norm(product.handedness)
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
    score += hasToken(title, input.shaftFlex) ? 5 : 1;
  if (
    ["driver", "fairway wood", "fairway_wood", "hybrid", "wedge"].includes(
      family,
    )
  ) {
    if (input.loftDegrees !== null && input.loftDegrees !== undefined)
      score += numericMention(title, input.loftDegrees) ? 5 : 2;
    if (input.clubNumber) score += hasToken(title, input.clubNumber) ? 3 : 1;
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
  if (strong.length >= 5 && markets.size >= 1)
    return {
      level: "SUFFICIENT_MEDIUM",
      reasons: ["FIVE_COMPATIBLE_COMPARABLES"],
    };
  return {
    level: "INSUFFICIENT",
    reasons: ["MORE_COMPATIBLE_EVIDENCE_REQUIRED"],
  };
}

function sourceQuality(candidate: ResearchCandidate): number {
  const seller = norm(candidate.seller);
  if (candidate.market === "BEST_ROUND_SALE") return 100;
  if (/golf|proshop|golf galaxy|pga/.test(seller)) return 85;
  if (seller && seller !== "unknown") return 65;
  return 45;
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
};

function externalCandidates(
  result: MarketPriceResult,
  market: ResearchMarket,
): ResearchCandidate[] {
  return result.sources.map((source) => ({
    title: source.productName,
    seller: source.merchant,
    priceMinor: source.priceMxn,
    currency: source.originalCurrency,
    market,
    source: result.provider,
    url: source.url,
    condition: source.condition,
    availability: source.availability,
    observedAt: source.checkedAt,
  }));
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
  const add = (candidate: ResearchCandidate) => {
    if (candidate.availability === "out_of_stock")
      return excluded.push({ ...candidate, exclusion: "OUT_OF_STOCK" });
    const match = scoreResearchSimilarity(input, candidate);
    if (match.hardMismatch || match.score < 55)
      return excluded.push({
        ...candidate,
        similarity: match.score,
        similarityReasons: match.reasons,
        exclusion: match.reasons[0] ?? "LOW_SIMILARITY",
      });
    const key = dedupeKey(candidate);
    if (accepted.some((item) => dedupeKey(item) === key))
      return excluded.push({ ...candidate, exclusion: "DUPLICATE" });
    const quality = sourceQuality(candidate);
    accepted.push({
      ...candidate,
      similarity: match.score,
      similarityReasons: match.reasons,
      sourceQuality: quality,
      evidenceScore: Math.round((match.score * quality) / 100),
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
        for (const candidate of externalCandidates(
          result,
          market === "MX" ? "MEXICO" : "USA",
        ))
          add(candidate);
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
    expiresAt: new Date(
      now.getTime() + RESEARCH_TTL_DAYS * 86_400_000,
    ).toISOString(),
    providerUnavailable,
    reasons: sufficiency.reasons,
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
