import type { MarketPriceResult } from "@/lib/pricing/market-price-provider";

export type MarketResearchRequest = {
  productId: string | null;
  brandId: string;
  categoryId: string;
  condition: "new" | "used";
  conditionGrade: string | null;
  conditionScore: number | null;
  targetPlayer: string | null;
  model: string;
  modelYear: number | null;
  clubNumber: string | null;
  loftDegrees: number | null;
  handedness: string | null;
  shaftMaterial: string | null;
  shaftBrand: string | null;
  shaftModel: string | null;
  shaftFlex: string | null;
  acquisitionCost: string;
};

export type MarketResearchActionResult =
  | {
      status: "success" | "unavailable";
      message: string;
      researchId: string;
      market: MarketPriceResult;
      fromCache: boolean;
    }
  | { status: "error"; message: string };
