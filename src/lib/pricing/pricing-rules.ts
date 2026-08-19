import type {
  PaymentFeeConfig,
  PricingRuleCode,
  PricingRuleResolutionInput,
} from "@/lib/pricing/pricing-types";

export const PRICING_HEALTH_TOLERANCE_BPS = 1_000;

export const PETER_GOLF_PAYMENT_FEE: PaymentFeeConfig = {
  code: "stripe_domestic_mx",
  percentageBps: 360,
  fixedFeeMinor: 300,
};

export const PRICING_TARGET_RETURN_BPS: Readonly<
  Record<PricingRuleCode, number>
> = {
  DRIVER_NEW: 3_000,
  FAIRWAY_WOOD_NEW: 3_000,
  HYBRID_NEW: 3_000,
  IRON_NEW: 3_000,
  IRON_SET_NEW: 3_000,
  WEDGE_NEW: 3_500,
  PUTTER_NEW: 3_500,
  COMPLETE_SET_NEW: 3_000,
  CLUB_USED: 4_000,
  IRON_SET_USED: 4_000,
  PUTTER_USED: 4_000,
  COMPLETE_SET_USED: 4_000,
  TRADE_IN: 5_000,
  GOLF_BAG: 4_000,
  APPAREL: 4_500,
  SHOES: 4_000,
  BALLS: 2_500,
  GLOVES: 4_000,
  GRIPS: 4_500,
  ACCESSORY: 4_500,
  SMALL_ACCESSORY: 6_000,
  GPS_RANGEFINDER: 3_000,
  TRAINING_GADGET: 4_000,
  OTHER: 3_500,
};

const NEW_CLUB_RULES = {
  driver: "DRIVER_NEW",
  fairway_wood: "FAIRWAY_WOOD_NEW",
  hybrid: "HYBRID_NEW",
  iron: "IRON_NEW",
  wedge: "WEDGE_NEW",
  putter: "PUTTER_NEW",
} as const satisfies Record<
  NonNullable<PricingRuleResolutionInput["clubType"]>,
  PricingRuleCode
>;

const USED_CLUB_RULES = {
  driver: "CLUB_USED",
  fairway_wood: "CLUB_USED",
  hybrid: "CLUB_USED",
  iron: "CLUB_USED",
  wedge: "CLUB_USED",
  putter: "PUTTER_USED",
} as const satisfies Record<
  NonNullable<PricingRuleResolutionInput["clubType"]>,
  PricingRuleCode
>;

const GENERIC_CATEGORY_RULES: Readonly<Record<string, PricingRuleCode>> = {
  apparel: "APPAREL",
  ropa: "APPAREL",
  shoes: "SHOES",
  calzado: "SHOES",
  balls: "BALLS",
  pelotas: "BALLS",
  gloves: "GLOVES",
  guantes: "GLOVES",
  grips: "GRIPS",
  accessories: "ACCESSORY",
  accesorios: "ACCESSORY",
  "small-accessories": "SMALL_ACCESSORY",
  "gps-rangefinders": "GPS_RANGEFINDER",
  "training-gadgets": "TRAINING_GADGET",
};

export function resolvePricingRule(
  input: PricingRuleResolutionInput,
): PricingRuleCode {
  if (input.acquisitionChannel === "trade_in") return "TRADE_IN";
  if (input.productFamily === "club" && input.clubType) {
    return input.condition === "new"
      ? NEW_CLUB_RULES[input.clubType]
      : USED_CLUB_RULES[input.clubType];
  }
  if (input.productFamily === "bag") return "GOLF_BAG";
  if (input.productFamily === "set" && input.setType) {
    if (input.setType === "iron_set") {
      return input.condition === "new" ? "IRON_SET_NEW" : "IRON_SET_USED";
    }
    return input.condition === "new" ? "COMPLETE_SET_NEW" : "COMPLETE_SET_USED";
  }
  if (input.condition === "new" && input.mappedNewRule) {
    return input.mappedNewRule;
  }
  if (input.condition === "used" && input.mappedUsedRule) {
    return input.mappedUsedRule;
  }
  return GENERIC_CATEGORY_RULES[input.categorySlug ?? ""] ?? "OTHER";
}
