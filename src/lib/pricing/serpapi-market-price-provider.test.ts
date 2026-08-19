import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { MarketPriceInput } from "@/lib/pricing/market-price-provider";
import {
  buildMarketSearchQuery,
  SerpApiMarketPriceProvider,
} from "@/lib/pricing/serpapi-market-price-provider";

const input: MarketPriceInput = {
  brand: "Titleist",
  model: "GT3",
  modelYear: 2025,
  productFamily: "club",
  clubType: "driver",
  clubNumber: null,
  setType: null,
  bagType: null,
  loftDegrees: 9,
  handedness: "right",
  shaftMaterial: "graphite",
  shaftBrand: "Mitsubishi",
  shaftModel: "Tensei 1K Blue",
  shaftFlex: "regular",
  condition: "new",
  conditionGrade: null,
  conditionScore: null,
  targetPlayer: "men",
  market: "MX",
};

function response(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

describe("SerpApiMarketPriceProvider", () => {
  it("builds a controlled Mexico query from structured product attributes", () => {
    const query = buildMarketSearchQuery(input);
    expect(query).toContain("Titleist GT3");
    expect(query).toContain("driver");
    expect(query).toContain("México");
    expect(query).not.toContain("http");
  });

  it("loads comparables through the fixed SerpApi endpoint without exposing credentials", async () => {
    let requestedUrl: URL | null = null;
    const fetchMock = vi.fn(async (request: URL | RequestInfo) => {
      requestedUrl = new URL(String(request));
      return response({
        shopping_results: [
          {
            title: "Titleist GT3 Driver 9 Regular Right Hand",
            source: "Golf México",
            extracted_price: 12499,
            product_id: "one",
            link: "javascript:alert('unsafe')",
            extensions: ["Disponible"],
          },
          {
            title: "Titleist GT3 Driver 9 Regular Right Hand 2025",
            source: "Pro Shop México",
            extracted_price: 12999,
            product_id: "two",
            link: "https://merchant.example/gt3-2",
            extensions: ["En existencia"],
          },
          {
            title: "Titleist GT3 Driver 9 Regular Right Hand",
            source: "Golf México",
            extracted_price: 11999,
            product_id: "three",
            link: "https://merchant.example/gt3-3",
          },
          {
            title: "Titleist GT2 Driver 9 Regular Right Hand",
            source: "Otro comercio",
            extracted_price: 3999,
            product_id: "wrong-model",
          },
        ],
      });
    });
    const provider = new SerpApiMarketPriceProvider(
      "secret-test-key",
      fetchMock as typeof fetch,
    );

    const result = await provider.getMarketPrice(input, { forceRefresh: true });

    expect(requestedUrl).not.toBeNull();
    expect(requestedUrl!.origin).toBe("https://serpapi.com");
    expect(requestedUrl!.pathname).toBe("/search.json");
    expect(requestedUrl!.searchParams.get("engine")).toBe("google_shopping");
    expect(requestedUrl!.searchParams.get("gl")).toBe("mx");
    expect(requestedUrl!.searchParams.get("no_cache")).toBe("true");
    expect(result.sampleSize).toBe(3);
    expect(result.medianPriceMxn).toBe(1_249_900);
    expect(result.averagePriceMxn).toBe(1_249_900);
    expect(result.excludedCount).toBe(1);
    expect(
      result.sources.find((source) => source.identifier === "one")?.url,
    ).toBeNull();
    expect(JSON.stringify(result)).not.toContain("secret-test-key");
  });
});
