import { NextResponse } from "next/server";

import { serverEnv } from "@/env/server";
import {
  researchBestRoundIntelligence,
  type ResearchProductInput,
} from "@/lib/pricing/intelligence-research";
import { calculateFirstPartyDecision } from "@/lib/pricing/intelligence-economics";
import { getConfiguredMarketPriceProvider } from "@/lib/pricing/market-price-service";
import type {
  MarketPriceProvider,
  MarketPriceResult,
} from "@/lib/pricing/market-price-provider";

export const runtime = "nodejs";

const input: ResearchProductInput = {
  brand: "Titleist",
  model: "GT3",
  modelYear: 2024,
  productFamily: "club",
  clubType: "driver",
  clubNumber: null,
  setType: null,
  bagType: null,
  loftDegrees: 9,
  handedness: "right",
  shaftMaterial: "graphite",
  shaftBrand: null,
  shaftModel: null,
  shaftFlex: "regular",
  condition: "used",
  conditionGrade: "A",
  conditionScore: 9,
  targetPlayer: null,
  market: "MX",
};

function provider(): MarketPriceProvider {
  return {
    async getMarketPrice(_input, options): Promise<MarketPriceResult> {
      const us = options?.market === "US";
      const now = new Date().toISOString();
      return {
        medianPriceMxn: null,
        averagePriceMxn: null,
        lowPriceMxn: null,
        highPriceMxn: null,
        sampleSize: 0,
        confidence: "unavailable",
        source: null,
        sourceUrl: null,
        checkedAt: now,
        provider: us ? "qa-usa" : "qa-mexico",
        searchQuery: options?.query ?? null,
        excludedCount: 0,
        sources: us
          ? [
              {
                merchant: "QA Golf US",
                productName: "Titleist GT3 Driver 9 right regular",
                priceMxn: 110000,
                originalCurrency: "USD",
                originalPrice: "550",
                url: "https://qa.example.test/gt3",
                identifier: "qa-gt3",
                availability: "in_stock",
                condition: "used",
                marketScope: "international",
                matchScore: 0,
                checkedAt: now,
                matchConfidence: "medium",
              },
            ]
          : [],
      };
    },
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const isStaging = serverEnv.NEXT_PUBLIC_SUPABASE_URL?.includes(
    "xdulakstgsgdujjylhox",
  );
  if (
    !isStaging ||
    (url.searchParams.get("synthetic") !== "1" &&
      url.searchParams.get("real") !== "1")
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (url.searchParams.get("real") === "1") {
    const configured = getConfiguredMarketPriceProvider();
    const result = await researchBestRoundIntelligence(input, {
      provider: configured.provider,
      maxMexicoQueries: 3,
      maxUsaQueries: 2,
      forceRefresh: true,
    });
    const economics = calculateFirstPartyDecision({
      research: result,
      costs: { acquisitionCostMinor: 500000, shippingMinor: 10000 },
    });
    return NextResponse.json({
      provider: configured.name,
      mexicoQueries: result.mexicoQueriesExecuted,
      usaQueries: result.usaQueriesExecuted,
      accepted: result.acceptedComparables.length,
      excluded: result.excludedComparables.length,
      evidenceLevel: result.evidenceLevel,
      confidence: result.confidence,
      resolutionSource: result.resolutionSource,
      economics: {
        marketLowMinor: economics.marketLowMinor,
        marketReferenceMinor: economics.marketReferenceMinor,
        marketHighMinor: economics.marketHighMinor,
        minimumSafePriceMinor: economics.minimumSafePriceMinor,
        targetEconomicPriceMinor: economics.targetEconomicPriceMinor,
        recommendedPriceMinor: economics.recommendedPriceMinor,
        expectedMarginBps: economics.expectedMarginBps,
        semaphore: economics.semaphore,
        confidence: economics.confidence,
        rotation: economics.rotation,
        idealAcquisitionCostMinor: economics.idealAcquisitionCostMinor,
        maximumAcquisitionCostMinor: economics.maximumAcquisitionCostMinor,
      },
      topComparables: result.acceptedComparables.slice(0, 5).map((item) => ({
        source: item.source,
        seller: item.seller,
        title: item.title,
        priceMinor: item.priceMinor,
        market: item.market,
        similarity: item.similarity,
        sourceQuality: item.sourceQuality,
        marketPriority: item.marketPriorityScore,
        recency: item.recencyScore,
        evidenceScore: item.evidenceScore,
      })),
      exclusionReasons: result.excludedComparables.reduce<
        Record<string, number>
      >((acc, item) => {
        acc[item.exclusion] = (acc[item.exclusion] ?? 0) + 1;
        return acc;
      }, {}),
    });
  }
  const usa = await researchBestRoundIntelligence(input, {
    provider: provider(),
    forceRefresh: true,
    maxMexicoQueries: 2,
    maxUsaQueries: 1,
  });
  const cached = await researchBestRoundIntelligence(input, {
    provider: {
      getMarketPrice: async () => {
        throw new Error("external provider must not be called for cache hit");
      },
    },
    savedResearch: Array.from({ length: 5 }, (_, index) => ({
      title: "Titleist GT3 Driver 9 right regular",
      seller: `Saved retailer ${index + 1}`,
      priceMinor: 100000 + index * 1000,
      market: "SAVED_RESEARCH" as const,
      source: "saved",
      condition: "used" as const,
      observedAt: new Date().toISOString(),
      similarity: 95,
    })),
  });
  const cachedEconomics = calculateFirstPartyDecision({
    research: cached,
    costs: { acquisitionCostMinor: 500000 },
  });
  return NextResponse.json({
    driver: {
      mexicoQueries: usa.mexicoQueriesExecuted,
      accepted: usa.acceptedComparables.length,
      evidenceLevel: usa.evidenceLevel,
      resolutionSource: usa.resolutionSource,
    },
    usaFallback: {
      mexicoQueries: usa.mexicoQueriesExecuted,
      usaQueries: usa.usaQueriesExecuted,
      used: usa.usaQueriesExecuted > 0,
    },
    cacheHit: {
      cachedResearchUsed: cached.cachedResearchUsed,
      externalQueries: cached.mexicoQueriesExecuted + cached.usaQueriesExecuted,
      recommendedPriceMinor: cachedEconomics.recommendedPriceMinor,
    },
  });
}
