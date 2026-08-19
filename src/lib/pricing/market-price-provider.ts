import type {
  MarketConfidence,
  MarketReference,
} from "@/lib/pricing/pricing-types";

export type MarketPriceInput = {
  brand: string | null;
  model: string | null;
  modelYear: number | null;
  productFamily: "club" | "bag" | "set" | null;
  clubType: string | null;
  clubNumber: string | null;
  setType: string | null;
  bagType: string | null;
  loftDegrees: number | null;
  handedness: string | null;
  shaftMaterial: string | null;
  shaftBrand: string | null;
  shaftModel: string | null;
  shaftFlex: string | null;
  condition: "new" | "used";
  conditionGrade: string | null;
  conditionScore: number | null;
  targetPlayer: string | null;
  market: "MX";
};

export type MarketPriceSource = {
  merchant: string;
  productName: string;
  priceMxn: number;
  originalCurrency: string;
  originalPrice: string;
  url: string | null;
  identifier: string | null;
  availability: "in_stock" | "out_of_stock" | "unknown";
  condition: "new" | "used" | "refurbished" | "unknown";
  marketScope: "mexico" | "ships_to_mexico" | "international" | "unknown";
  matchScore: number;
  checkedAt: string;
  matchConfidence: Exclude<MarketConfidence, "unavailable">;
};

export type MarketPriceResult = MarketReference & {
  provider: string;
  searchQuery: string | null;
  sources: MarketPriceSource[];
  excludedCount: number;
};

export interface MarketPriceProvider {
  getMarketPrice(
    input: MarketPriceInput,
    options?: { forceRefresh?: boolean },
  ): Promise<MarketPriceResult>;
}

export class UnavailableMarketPriceProvider implements MarketPriceProvider {
  async getMarketPrice(_input: MarketPriceInput): Promise<MarketPriceResult> {
    void _input;
    return {
      medianPriceMxn: null,
      averagePriceMxn: null,
      lowPriceMxn: null,
      highPriceMxn: null,
      sampleSize: 0,
      confidence: "unavailable",
      source: null,
      sourceUrl: null,
      checkedAt: null,
      provider: "unavailable",
      searchQuery: null,
      sources: [],
      excludedCount: 0,
    };
  }
}
