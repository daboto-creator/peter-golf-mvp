import type { MarketPriceResult } from "@/lib/pricing/market-price-provider";
import type { FirstPartyDecision } from "@/lib/pricing/intelligence-economics";
import type { ResearchResult } from "@/lib/pricing/intelligence-research";

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
  conditioningCost: string;
  packagingCost: string;
  shippingSubsidy: string;
};

export type MarketResearchActionResult =
  | {
      status: "success" | "unavailable";
      message: string;
      researchId: string;
      market: MarketPriceResult;
      fromCache: boolean;
      intelligence: {
        research: ResearchResult;
        decision: FirstPartyDecision;
      };
    }
  | { status: "error"; message: string };

export type FirstPartyIntelligence = Extract<
  MarketResearchActionResult,
  { status: "success" | "unavailable" }
>["intelligence"];
