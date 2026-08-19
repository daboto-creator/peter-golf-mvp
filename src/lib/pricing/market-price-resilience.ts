import {
  UnavailableMarketPriceProvider,
  type MarketPriceInput,
  type MarketPriceProvider,
  type MarketPriceResult,
} from "@/lib/pricing/market-price-provider";

export async function researchMarketPriceSafely(
  input: MarketPriceInput,
  options: {
    provider: MarketPriceProvider;
    forceRefresh?: boolean;
    failureProviderName?: string;
  },
): Promise<{ result: MarketPriceResult; failed: boolean }> {
  try {
    return {
      result: await options.provider.getMarketPrice(input, {
        forceRefresh: options.forceRefresh,
      }),
      failed: false,
    };
  } catch {
    const fallback = await new UnavailableMarketPriceProvider().getMarketPrice(
      input,
    );
    return {
      result: {
        ...fallback,
        provider: options.failureProviderName ?? "unavailable",
        checkedAt: new Date().toISOString(),
      },
      failed: true,
    };
  }
}
