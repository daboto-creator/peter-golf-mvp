import "server-only";

import { serverEnv } from "@/env/server";
import {
  UnavailableMarketPriceProvider,
  type MarketPriceProvider,
} from "@/lib/pricing/market-price-provider";
import { SerpApiMarketPriceProvider } from "@/lib/pricing/serpapi-market-price-provider";

export function getConfiguredMarketPriceProvider(): {
  name: "serpapi" | "unavailable";
  provider: MarketPriceProvider;
} {
  if (
    serverEnv.MARKET_PRICE_PROVIDER === "serpapi" &&
    serverEnv.SERPAPI_API_KEY
  ) {
    return {
      name: "serpapi",
      provider: new SerpApiMarketPriceProvider(serverEnv.SERPAPI_API_KEY),
    };
  }
  return {
    name: "unavailable",
    provider: new UnavailableMarketPriceProvider(),
  };
}
