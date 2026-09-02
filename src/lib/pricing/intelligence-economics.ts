import { ceilDivide, ratioToBps, toSafeMinorUnits } from "@/lib/pricing/money";
import { roundUpToCommercialPrice } from "@/lib/pricing/commercial-rounding";
import type {
  ResearchCandidate,
  ResearchResult,
} from "@/lib/pricing/intelligence-research";

export const ECONOMICS_ENGINE_VERSION = "best-round-economics-v1";
export const DEFAULT_MARGIN_POLICY = {
  version: "margin-policy-v1",
  minimumMarginBps: 1_000,
  targetMarginBps: 1_500,
  stretchMarginBps: 2_000,
} as const;

export type EconomicsSemaphore = "GREEN" | "YELLOW" | "RED";
export type DecisionConfidence = "HIGH" | "MEDIUM" | "LOW";
export type Rotation = "FAST" | "MEDIUM" | "SLOW" | "UNKNOWN";
export type EconomicsCosts = {
  acquisitionCostMinor: number;
  paymentProcessingMinor?: number;
  shippingMinor?: number;
  packagingMinor?: number;
  refurbishmentMinor?: number;
  reserveMinor?: number;
  otherDirectCostMinor?: number;
};
export type MarginPolicy = {
  version: string;
  minimumMarginBps: number;
  targetMarginBps: number;
  stretchMarginBps?: number;
};
export type MarketSummary = {
  marketLowMinor: number | null;
  marketReferenceMinor: number | null;
  marketHighMinor: number | null;
  dispersionBps: number | null;
  dispersion: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
  internalContribution: number;
  mexicoContribution: number;
  usaContribution: number;
};
export type FirstPartyDecision = MarketSummary & {
  minimumSafePriceMinor: number | null;
  targetEconomicPriceMinor: number | null;
  recommendedPriceMinor: number | null;
  expectedMarginBps: number | null;
  semaphore: EconomicsSemaphore;
  confidence: DecisionConfidence;
  rotation: Rotation;
  rotationRange: string | null;
  idealAcquisitionCostMinor: number | null;
  maximumAcquisitionCostMinor: number | null;
  explanation: string;
  costsMinor: number;
};

function assertMoney(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error("Importe inválido.");
}
function totalCosts(costs: EconomicsCosts): number {
  const values = Object.values(costs) as number[];
  values.forEach(assertMoney);
  return values.reduce((sum, value) => sum + value, 0);
}
function weightedQuantile(candidates: ResearchCandidate[], q: number): number {
  const ordered = [...candidates].sort((a, b) => a.priceMinor - b.priceMinor);
  const total = ordered.reduce(
    (sum, c) => sum + Math.max(1, c.evidenceScore ?? c.similarity ?? 0),
    0,
  );
  let cumulative = 0;
  for (const candidate of ordered) {
    cumulative += Math.max(
      1,
      candidate.evidenceScore ?? candidate.similarity ?? 0,
    );
    if (cumulative >= total * q) return candidate.priceMinor;
  }
  return ordered.at(-1)?.priceMinor ?? 0;
}

export function summarizeResearchMarket(
  research: ResearchResult,
): MarketSummary {
  const candidates = research.acceptedComparables.filter(
    (c) =>
      (c.currency === undefined || c.currency === "MXN") &&
      Number.isSafeInteger(c.priceMinor) &&
      c.priceMinor > 0 &&
      (c.originalCurrency === undefined ||
        c.originalCurrency === null ||
        c.originalCurrency.toUpperCase() === "MXN" ||
        c.normalizedPriceMxnMinor === c.priceMinor),
  );
  if (!candidates.length) {
    return {
      marketLowMinor: null,
      marketReferenceMinor: null,
      marketHighMinor: null,
      dispersionBps: null,
      dispersion: "UNKNOWN",
      internalContribution: 0,
      mexicoContribution: 0,
      usaContribution: 0,
    };
  }
  const reference = weightedQuantile(candidates, 0.5);
  const low = weightedQuantile(candidates, 0.2);
  const high = weightedQuantile(candidates, 0.8);
  const spreadBps = reference
    ? Math.round(((high - low) * 10_000) / reference)
    : null;
  const dispersion =
    spreadBps === null
      ? "UNKNOWN"
      : spreadBps <= 1_500
        ? "LOW"
        : spreadBps <= 3_000
          ? "MEDIUM"
          : "HIGH";
  return {
    marketLowMinor: low,
    marketReferenceMinor: reference,
    marketHighMinor: high,
    dispersionBps: spreadBps,
    dispersion,
    internalContribution: candidates.filter(
      (c) => c.market === "BEST_ROUND_SALE",
    ).length,
    mexicoContribution: candidates.filter((c) => c.market === "MEXICO").length,
    usaContribution: candidates.filter((c) => c.market === "USA").length,
  };
}

function inversePrice(costsMinor: number, marginBps: number): number {
  return toSafeMinorUnits(
    ceilDivide(BigInt(costsMinor) * BigInt(10_000), BigInt(10_000 - marginBps)),
    "Precio seguro",
  );
}
function inverseAcquisition(
  priceMinor: number,
  nonAcquisitionCostsMinor: number,
  marginBps: number,
): number {
  const gross =
    (BigInt(priceMinor) * BigInt(10_000 - marginBps)) / BigInt(10_000);
  const result = gross - BigInt(nonAcquisitionCostsMinor);
  return Number(result > BigInt(0) ? result : BigInt(0));
}

export function calculateFirstPartyDecision(input: {
  research: ResearchResult;
  costs: EconomicsCosts;
  policy?: MarginPolicy;
}): FirstPartyDecision {
  const policy = input.policy ?? DEFAULT_MARGIN_POLICY;
  const market = summarizeResearchMarket(input.research);
  const costsMinor = totalCosts(input.costs);
  if (
    policy.minimumMarginBps < 0 ||
    policy.targetMarginBps < policy.minimumMarginBps ||
    policy.targetMarginBps >= 10_000
  )
    throw new Error("Política de margen inválida.");
  if (!market.marketReferenceMinor)
    return {
      ...market,
      minimumSafePriceMinor: null,
      targetEconomicPriceMinor: null,
      recommendedPriceMinor: null,
      expectedMarginBps: null,
      semaphore: "RED",
      confidence: "LOW",
      rotation: "UNKNOWN",
      rotationRange: null,
      idealAcquisitionCostMinor: null,
      maximumAcquisitionCostMinor: null,
      explanation:
        "No hay evidencia de mercado suficiente para una recomendación segura.",
      costsMinor,
    };
  const minimumSafePriceMinor = inversePrice(
    costsMinor,
    policy.minimumMarginBps,
  );
  const targetEconomicPriceMinor = inversePrice(
    costsMinor,
    policy.targetMarginBps,
  );
  const marketPrice = market.marketReferenceMinor;
  const candidate = Math.max(targetEconomicPriceMinor, marketPrice);
  const recommendedPriceMinor = roundUpToCommercialPrice(
    candidate,
    market.marketHighMinor,
  );
  const expectedMarginBps = ratioToBps(
    recommendedPriceMinor - costsMinor,
    recommendedPriceMinor,
  );
  const red = minimumSafePriceMinor > (market.marketHighMinor ?? marketPrice);
  const yellow =
    !red &&
    (expectedMarginBps < policy.targetMarginBps ||
      input.research.confidence === "LOW" ||
      market.dispersion === "HIGH" ||
      market.usaContribution > market.mexicoContribution ||
      (market.marketHighMinor !== null &&
        recommendedPriceMinor > market.marketHighMinor));
  const semaphore: EconomicsSemaphore = red
    ? "RED"
    : yellow
      ? "YELLOW"
      : "GREEN";
  const confidence: DecisionConfidence = researchConfidence(
    input.research.confidence,
    market,
  );
  const rotation =
    recommendedPriceMinor <= (market.marketLowMinor ?? recommendedPriceMinor)
      ? "FAST"
      : recommendedPriceMinor >=
          (market.marketHighMinor ?? recommendedPriceMinor)
        ? "SLOW"
        : "MEDIUM";
  return {
    ...market,
    minimumSafePriceMinor,
    targetEconomicPriceMinor,
    recommendedPriceMinor,
    expectedMarginBps,
    semaphore,
    confidence,
    rotation,
    rotationRange:
      rotation === "FAST"
        ? "0–30 días"
        : rotation === "SLOW"
          ? "60–90+ días"
          : "30–60 días",
    idealAcquisitionCostMinor: inverseAcquisition(
      recommendedPriceMinor,
      costsMinor - input.costs.acquisitionCostMinor,
      policy.targetMarginBps,
    ),
    maximumAcquisitionCostMinor: inverseAcquisition(
      marketPrice,
      costsMinor - input.costs.acquisitionCostMinor,
      policy.minimumMarginBps,
    ),
    explanation: red
      ? "Para proteger el margen mínimo sería necesario vender por encima del mercado observado."
      : yellow
        ? "El precio es competitivo, pero conviene validar el margen y la evidencia."
        : "El precio recomendado está dentro del mercado y conserva el margen objetivo.",
    costsMinor,
  };
}

function researchConfidence(
  value: ResearchResult["confidence"],
  market: MarketSummary,
): DecisionConfidence {
  if (value === "INSUFFICIENT" || market.dispersion === "HIGH") return "LOW";
  if (
    value === "LOW" ||
    market.usaContribution > market.mexicoContribution ||
    market.dispersion === "MEDIUM"
  )
    return "MEDIUM";
  return "HIGH";
}

export type MarketplaceDesiredPriceStatus =
  | "DESIRED_PRICE_OK"
  | "DESIRED_PRICE_HIGH"
  | "DESIRED_PRICE_LOW_BUT_VIABLE"
  | "DESIRED_PRICE_ECONOMICALLY_INVALID";
export function evaluateMarketplaceDesiredPrice(input: {
  desiredPriceMinor: number;
  recommendedPriceMinor: number | null;
  marketLowMinor: number | null;
  marketHighMinor: number | null;
  partnerNetMinor: number;
  minimumPartnerNetMinor: number;
}): MarketplaceDesiredPriceStatus {
  if (input.partnerNetMinor < input.minimumPartnerNetMinor)
    return "DESIRED_PRICE_ECONOMICALLY_INVALID";
  if (input.recommendedPriceMinor === null) return "DESIRED_PRICE_OK";
  if (
    input.marketHighMinor !== null &&
    input.desiredPriceMinor > input.marketHighMinor
  )
    return "DESIRED_PRICE_HIGH";
  if (
    input.marketLowMinor !== null &&
    input.desiredPriceMinor < input.marketLowMinor
  )
    return "DESIRED_PRICE_LOW_BUT_VIABLE";
  return "DESIRED_PRICE_OK";
}

export type FxRate = {
  rateNumerator: bigint;
  rateDenominator: bigint;
  source: string;
  observedAt: string;
};
export interface FxRateProvider {
  getUsdToMxn(): Promise<FxRate | null>;
}
export function convertUsdToMxn(priceMinor: number, fx: FxRate): number {
  assertMoney(priceMinor);
  if (fx.rateNumerator <= BigInt(0) || fx.rateDenominator <= BigInt(0))
    throw new Error("Tipo de cambio inválido.");
  return toSafeMinorUnits(
    ceilDivide(BigInt(priceMinor) * fx.rateNumerator, fx.rateDenominator),
    "Precio MXN",
  );
}

export type UsaLandedAssumptions = {
  shippingMinor: number;
  importTaxBps: number;
  handlingMinor: number;
  version: string;
};

export function calculateUsaLandedReference(input: {
  observedUsdMinor: number;
  fx: FxRate;
  assumptions: UsaLandedAssumptions;
}): number {
  const base = convertUsdToMxn(input.observedUsdMinor, input.fx);
  assertMoney(input.assumptions.shippingMinor);
  assertMoney(input.assumptions.handlingMinor);
  if (
    !Number.isSafeInteger(input.assumptions.importTaxBps) ||
    input.assumptions.importTaxBps < 0 ||
    input.assumptions.importTaxBps >= 10_000
  )
    throw new Error("Supuesto de importación inválido.");
  const tax = toSafeMinorUnits(
    ceilDivide(
      BigInt(base) * BigInt(input.assumptions.importTaxBps),
      BigInt(10_000),
    ),
    "Impuesto estimado",
  );
  return toSafeMinorUnits(
    BigInt(base) +
      BigInt(tax) +
      BigInt(input.assumptions.shippingMinor) +
      BigInt(input.assumptions.handlingMinor),
    "Referencia puesta en México",
  );
}
