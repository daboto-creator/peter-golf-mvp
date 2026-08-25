export const marketplaceTiers = [
  "BOGEY",
  "PAR",
  "BIRDIE",
  "ALBATROSS",
  "HOLE_IN_ONE",
] as const;

export type MarketplaceTier = (typeof marketplaceTiers)[number];
export type MarketplacePricingInputMode =
  "PUBLIC_PRICE_PRIORITY" | "NET_PRIORITY";
export type MarketplaceViability =
  | "COMPETITIVE"
  | "SLIGHTLY_HIGH"
  | "OVERPRICED"
  | "UNDERPRICED"
  | "INSUFFICIENT_DATA";

export type MarketplaceEconomicsConfig = {
  commissionBps: number;
  commissionVatBps: number;
  paymentProcessingBps: number;
  paymentProcessingFixedMinor: number;
  partnerProcessingShareBps: number;
  adminFeeBps: number;
  adminFixedFeeMinor: number;
  minimumMarketplaceRevenueMinor: number | null;
};

export type MarketplaceEconomics = {
  publicPriceMinor: number;
  commissionBaseMinor: number;
  commissionMinor: number;
  commissionVatMinor: number;
  processingTotalMinor: number;
  partnerProcessingShareMinor: number;
  bestRoundProcessingShareMinor: number;
  adminPercentageFeeMinor: number;
  adminFixedFeeMinor: number;
  otherConfiguredFeesMinor: number;
  partnerNetMinor: number;
  grossBestRoundRevenueMinor: number;
  taxPassThroughMinor: number;
  estimatedBestRoundRevenueMinor: number;
  meetsMinimumMarketplaceRevenue: boolean | null;
};

export type MarketplacePriceResolution = {
  inputMode: MarketplacePricingInputMode;
  desiredPublicPriceMinor: number | null;
  desiredPartnerNetMinor: number | null;
  calculatedPublicPriceMinor: number;
  economics: MarketplaceEconomics;
  desiredNetDeltaMinor: number | null;
};

export type MarketplaceNormalizedComparable = {
  source: string;
  title: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  condition: "new" | "used" | "refurbished" | "unknown";
  priceMinor: number;
  currency: "MXN";
  seller: string;
  referenceUrl: string | null;
  availability: "in_stock" | "out_of_stock" | "unknown";
  shippingMinor: number | null;
  totalPriceMinor: number | null;
  matchScore: number;
  matchReasons: string[];
  observedAt: string;
};

export type MarketplaceMarketAnalysisResult = {
  status: "COMPLETE" | "INSUFFICIENT_DATA" | "PROVIDER_UNAVAILABLE";
  validComparableCount: number;
  medianPriceMinor: number | null;
  averagePriceMinor: number | null;
  lowMarketMinor: number | null;
  highMarketMinor: number | null;
  recommendedPriceMinor: number | null;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";
  flags: string[];
  analysisVersion: string;
  comparables: MarketplaceNormalizedComparable[];
};

export type MarketplaceIntelligenceInput = {
  canonicalProduct: {
    brand: string;
    model: string;
    category: string;
  };
  listing: {
    condition: "new" | "used";
    specifications: Readonly<Record<string, unknown>>;
    evaluation: Readonly<Record<string, unknown>> | null;
  };
  normalizedComparables: readonly MarketplaceNormalizedComparable[];
  historicalAnalysisIds: readonly string[];
};

export type MarketplaceIntelligenceOutput = {
  comparableRelevanceSuggestions: ReadonlyArray<{
    reference: string;
    suggestedScore: number;
  }>;
  anomalyFlags: readonly string[];
  commentary: string;
  recommendation: string;
  confidenceReasoning: string;
};
