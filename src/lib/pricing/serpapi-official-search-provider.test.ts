import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GOLF_REFERENCE_CATEGORIES } from "@/lib/catalog/golf-reference-discovery";
import { SerpApiOfficialSearchProvider } from "@/lib/pricing/serpapi-official-search-provider";

describe("SerpApiOfficialSearchProvider", () => {
  it("uses the existing SerpApi credential for a bounded site-restricted query", async () => {
    let requested: URL | null = null;
    const fetchMock = vi.fn(async (request: URL | RequestInfo) => {
      requested = new URL(String(request));
      return new Response(
        JSON.stringify({
          organic_results: [
            { link: "https://www.titleist.com/golf-clubs/drivers/gt3" },
            { link: "https://example.test/not-official" },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const provider = new SerpApiOfficialSearchProvider(
      "secret-test-key",
      fetchMock as typeof fetch,
    );
    const result = await provider.discover({
      brand: "Titleist",
      category: GOLF_REFERENCE_CATEGORIES[0],
      officialDomain: "titleist.com",
      limit: 2,
    });
    expect(requested!.origin).toBe("https://serpapi.com");
    expect(requested!.searchParams.get("engine")).toBe("google");
    expect(requested!.searchParams.get("q")).toBe(
      "Titleist Driver site:titleist.com",
    );
    expect(requested!.searchParams.get("num")).toBe("2");
    expect(result.urls).toHaveLength(2);
    expect(JSON.stringify(result)).not.toContain("secret-test-key");
  });

  it("classifies a provider rate limit without returning URLs", async () => {
    const provider = new SerpApiOfficialSearchProvider(
      "secret-test-key",
      vi.fn(
        async () => new Response("limited", { status: 429 }),
      ) as typeof fetch,
    );
    const result = await provider.discover({
      brand: "Titleist",
      category: GOLF_REFERENCE_CATEGORIES[0],
      officialDomain: "titleist.com",
      limit: 2,
    });
    expect(result.urls).toEqual([]);
    expect(result.diagnostic.failureClass).toBe("RATE_LIMITED");
  });
});
