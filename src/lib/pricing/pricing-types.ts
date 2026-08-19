export const pricingRuleCodes = [
  "DRIVER_NEW",
  "FAIRWAY_WOOD_NEW",
  "HYBRID_NEW",
  "IRON_NEW",
  "IRON_SET_NEW",
  "WEDGE_NEW",
  "PUTTER_NEW",
  "COMPLETE_SET_NEW",
  "CLUB_USED",
  "IRON_SET_USED",
  "PUTTER_USED",
  "COMPLETE_SET_USED",
  "TRADE_IN",
  "GOLF_BAG",
  "APPAREL",
  "SHOES",
  "BALLS",
  "GLOVES",
  "GRIPS",
  "ACCESSORY",
  "SMALL_ACCESSORY",
  "GPS_RANGEFINDER",
  "TRAINING_GADGET",
  "OTHER",
] as const;

export type PricingRuleCode = (typeof pricingRuleCodes)[number];
export type AcquisitionChannel = "purchase" | "trade_in";
export type PricingStatus =
  | "AUTO_COMPETITIVE"
  | "ABOVE_MARKET_WARNING"
  | "AUTO_MARKET_ADJUSTED_UP"
  | "NO_MARKET_REFERENCE";
export type PricingHealth = "GREEN" | "YELLOW" | "RED";
export type MarketConfidence = "high" | "medium" | "low" | "unavailable";

export type DirectCosts = {
  acquisitionCost: number;
  conditioningCost: number;
  packagingCost: number;
  shippingSubsidy: number;
};

export type PaymentFeeConfig = {
  code: string;
  percentageBps: number;
  fixedFeeMinor: number;
};

export type MarketReference = {
  medianPriceMxn: number | null;
  averagePriceMxn: number | null;
  lowPriceMxn: number | null;
  highPriceMxn: number | null;
  sampleSize: number;
  confidence: MarketConfidence;
  source: string | null;
  sourceUrl: string | null;
  checkedAt: string | null;
};

export type PricingEngineInput = {
  costs: DirectCosts;
  pricingRuleCode: PricingRuleCode;
  targetReturnBps: number;
  paymentFee: PaymentFeeConfig;
  market: MarketReference;
  finalSalePrice?: number | null;
  manualPriceReason?: string | null;
  canPriceBelowFinancial?: boolean;
};

export type PricingEngineResult = {
  totalDirectCost: number;
  desiredContribution: number;
  financialPrice: number;
  minimumCompetitivePrice: number | null;
  marketLowerBound: number | null;
  marketUpperBound: number | null;
  automaticSuggestedPrice: number;
  finalSalePrice: number;
  estimatedPaymentFee: number;
  expectedContribution: number;
  returnOnCostBps: number;
  marginOnSaleBps: number;
  marketDeltaBps: number | null;
  status: PricingStatus;
  health: PricingHealth;
  override: boolean;
  manualPriceReason: string | null;
  warnings: string[];
};

export type PricingRuleResolutionInput = {
  acquisitionChannel: AcquisitionChannel;
  condition: "new" | "used";
  productFamily: "club" | "bag" | "set" | null;
  clubType?:
    "driver" | "fairway_wood" | "hybrid" | "iron" | "wedge" | "putter" | null;
  setType?: "complete_set" | "iron_set" | "starter_set" | "junior_set" | null;
  mappedNewRule?: PricingRuleCode | null;
  mappedUsedRule?: PricingRuleCode | null;
  categorySlug?: string | null;
};
