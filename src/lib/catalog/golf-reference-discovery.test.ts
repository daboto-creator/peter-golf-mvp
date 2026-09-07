import { describe, expect, it, vi } from "vitest";

import {
  GOLF_REFERENCE_CATEGORIES,
  extractOfficialProductIdentity,
  isOfficialDomainUrl,
  normalizeModelIdentity,
  runGolfReferenceDiscovery,
  type FetchDiagnostic,
  type OfficialSearchProvider,
} from "@/lib/catalog/golf-reference-discovery";

const driver = { ...GOLF_REFERENCE_CATEGORIES[0], id: "driver-id" };
const brand = {
  id: "brand-id",
  name: "Titleist",
  slug: "titleist",
  officialDomain: "titleist.com",
  lastVerifiedAt: null,
};

function htmlResponse(body: string, status = 200, contentType = "text/html") {
  return new Response(body, {
    status,
    headers: { "content-type": contentType },
  });
}

function productPage(name = "Titleist GT3 Driver") {
  return `<html><head><script type="application/ld+json">${JSON.stringify({
    "@type": "Product",
    name,
    brand: { "@type": "Brand", name: "Titleist" },
  })}</script></head></html>`;
}

function fetchFrom(entries: Record<string, Response | (() => Response)>) {
  return vi.fn(async (request: URL | RequestInfo) => {
    const url = String(request);
    const entry = entries[url];
    if (!entry) return htmlResponse("not found", 404);
    return typeof entry === "function" ? entry() : entry.clone();
  });
}

function searchDiagnostic(brandName = "Titleist"): FetchDiagnostic {
  return {
    brand: brandName,
    category: "Driver",
    requestedHostname: "serpapi.com",
    requestedPath: "/search.json",
    strategy: "SEARCH_PROVIDER",
    httpStatus: 200,
    contentType: "application/json",
    responseBytes: 100,
    redirectCount: 0,
    timeout: false,
    networkError: null,
    tlsError: null,
    blocked: false,
    notFound: false,
    rateLimited: false,
    serverError: false,
    robotsBlock: false,
    htmlNoProducts: false,
    jsonLdFound: false,
    sitemapFound: false,
    parseError: false,
    failureClass: null,
  };
}

function searchProvider(urls: string[]): OfficialSearchProvider {
  return {
    discover: vi.fn(async () => ({ urls, diagnostic: searchDiagnostic() })),
  };
}

async function run(input: {
  fetchImpl: typeof fetch;
  searchProvider?: OfficialSearchProvider | null;
  canonical?: Array<{
    id: string;
    brandId: string;
    categoryId: string;
    categorySlug: string;
    normalizedModelName: string;
  }>;
  brandOverride?: Partial<typeof brand>;
  categories?: Array<
    (typeof GOLF_REFERENCE_CATEGORIES)[number] & { id: string }
  >;
}) {
  return runGolfReferenceDiscovery({
    brands: [{ ...brand, ...input.brandOverride }],
    categories: input.categories ?? [driver],
    canonicalModels: input.canonical ?? [],
    fetchImpl: input.fetchImpl,
    searchProvider: input.searchProvider,
    force: true,
    limits: {
      maxBrands: 1,
      maxCategoriesPerBrand: input.categories?.length ?? 1,
      maxProductPagesPerCategory: 2,
      maxSearchResultsPerCategory: 2,
      maxSitemapChildren: 1,
    },
  });
}

describe("golf reference discovery", () => {
  it("normalizes configuration details away from model identity", () => {
    expect(normalizeModelIdentity("GT3 Driver 10.5° RH Stiff")).toBe("gt3");
  });

  it("accepts the configured official domain and its subdomains only", () => {
    expect(
      isOfficialDomainUrl("https://www.titleist.com/a", "titleist.com"),
    ).toBe(true);
    expect(
      isOfficialDomainUrl("https://titleist.com.evil.test/a", "titleist.com"),
    ).toBe(false);
  });

  it("extracts an exact official JSON-LD Product and ignores a category page title", () => {
    expect(
      extractOfficialProductIdentity({
        html: productPage(),
        url: "https://www.titleist.com/golf-clubs/drivers/gt3",
        brand: "Titleist",
        category: driver,
      }).identities,
    ).toEqual([
      { modelName: "GT3", normalizedModelName: "gt3", confidence: "HIGH" },
    ]);
    expect(
      extractOfficialProductIdentity({
        html: "<title>Titleist Drivers</title><h1>Drivers</h1>",
        url: "https://www.titleist.com/golf-clubs/drivers/",
        brand: "Titleist",
        category: driver,
      }).identities,
    ).toEqual([]);
    expect(
      extractOfficialProductIdentity({
        html: "<title>Cobra KING TEC Hybrid Weights - Golf</title>",
        url: "https://www.cobragolf.com/products/king-tec-hybrid-weights",
        brand: "Cobra",
        category: GOLF_REFERENCE_CATEGORIES[2],
      }).identities,
    ).toEqual([]);
  });

  it("walks nested @graph, ItemList product references, arrays, and multiple JSON-LD blocks", () => {
    const html = `<script type="application/ld+json">{malformed</script>
      <script type="application/ld+json">${JSON.stringify({
        "@type": "CollectionPage",
        mainEntity: {
          "@type": "ItemList",
          itemListElement: [
            {
              item: {
                "@graph": [
                  {
                    "@type": "Product",
                    name: "Titleist GT3 Driver",
                    brand: { name: "Titleist" },
                  },
                ],
              },
            },
          ],
        },
      })}</script>
      <script type="application/ld+json">${JSON.stringify([
        { "@type": "BreadcrumbList" },
      ])}</script>`;
    const result = extractOfficialProductIdentity({
      html,
      url: "https://titleist.com/golf-clubs/drivers/gt3",
      brand: "Titleist",
      category: driver,
    });
    expect(result.parseError).toBe(true);
    expect(result.identities).toEqual([
      { modelName: "GT3", normalizedModelName: "gt3", confidence: "HIGH" },
    ]);
  });

  it("ignores homepage and category labels without product identity", () => {
    expect(
      extractOfficialProductIdentity({
        html: "<title>Titleist Golf Clubs</title><h1>Shop Drivers</h1>",
        url: "https://titleist.com/",
        brand: "Titleist",
        category: driver,
      }).identities,
    ).toEqual([]);
  });

  it("uses a product heading before weaker page metadata", () => {
    expect(
      extractOfficialProductIdentity({
        html: "<h1>Titleist GT4 Driver</h1><title>Titleist Golf Clubs</title>",
        url: "https://titleist.com/golf-clubs/drivers/gt4",
        brand: "Titleist",
        category: driver,
      }).identities,
    ).toEqual([
      { modelName: "GT4", normalizedModelName: "gt4", confidence: "MEDIUM" },
    ]);
  });

  it("rejects newsroom, collection, and generic heading identities", () => {
    expect(
      extractOfficialProductIdentity({
        html: "<title>Titleist Introduces New GTS300 Mini Driver | Newsroom</title>",
        url: "https://mediacenter.titleist.com/newsroom/titleist-introduces-new-gts300-mini-driver",
        brand: "Titleist",
        category: driver,
      }).identities,
    ).toEqual([]);
    expect(
      extractOfficialProductIdentity({
        html: "<title>Cobra Golf Clubs - Drivers</title><h1>Cobra Logo</h1>",
        url: "https://www.cobragolf.com/collections/golf-clubs-drivers",
        brand: "Cobra",
        category: driver,
      }).identities,
    ).toEqual([]);
    expect(
      extractOfficialProductIdentity({
        html: "<h1>PING All Putters</h1>",
        url: "https://ping.com/en-us/clubs/putters/all",
        brand: "PING",
        category: GOLF_REFERENCE_CATEGORIES[5],
      }).identities,
    ).toEqual([]);
  });

  it("strips a manufacturer site suffix and rejects accessory product URLs", () => {
    expect(
      extractOfficialProductIdentity({
        html: "<title>Cobra KING Tour Irons - Golf</title>",
        url: "https://www.cobragolf.com/products/king-tour-irons-2023",
        brand: "Cobra",
        category: GOLF_REFERENCE_CATEGORIES[3],
      }).identities,
    ).toEqual([
      {
        modelName: "KING Tour",
        normalizedModelName: "king-tour",
        confidence: "MEDIUM",
      },
    ]);
    expect(
      extractOfficialProductIdentity({
        html: "<title>Cobra Universal Hybrid Headcover - Golf</title>",
        url: "https://www.cobragolf.com/products/universal-hybrid-headcover",
        brand: "Cobra",
        category: GOLF_REFERENCE_CATEGORIES[2],
      }).identities,
    ).toEqual([]);
  });

  it("discovers and verifies a product from a direct official category page", async () => {
    const fetchMock = fetchFrom({
      "https://titleist.com/sitemap.xml": htmlResponse("not found", 404),
      "https://titleist.com/golf-clubs/drivers/": htmlResponse(
        '<a href="/golf-clubs/drivers/gt3">GT3</a>',
      ),
      "https://titleist.com/golf-clubs/drivers/gt3":
        htmlResponse(productPage()),
    });
    const result = await run({ fetchImpl: fetchMock as typeof fetch });
    expect(result.summary.modelIdentitiesExtracted).toBe(1);
    expect(result.discoveries[0]?.decision).toBe("VERIFIED");
  });

  it("uses a bounded official sitemap when the category page is a JS shell", async () => {
    const fetchMock = fetchFrom({
      "https://titleist.com/sitemap.xml": htmlResponse(
        "<urlset><url><loc>https://titleist.com/golf-clubs/drivers/gt3</loc></url></urlset>",
        200,
        "application/xml",
      ),
      "https://titleist.com/golf-clubs/drivers/":
        htmlResponse("<div id=app></div>"),
      "https://titleist.com/golf-clubs/drivers/gt3":
        htmlResponse(productPage()),
    });
    const result = await run({ fetchImpl: fetchMock as typeof fetch });
    expect(result.summary.officialUrlsDiscovered).toBe(1);
    expect(result.summary.existingModelsMatched).toBe(0);
    expect(result.discoveries[0]?.modelName).toBe("GT3");
  });

  it("reads a bounded sitemap index and product sitemap", async () => {
    const productUrl = "https://titleist.com/golf-clubs/drivers/gt3";
    const productSitemap = "https://titleist.com/sitemaps/product-sitemap.xml";
    const result = await run({
      fetchImpl: fetchFrom({
        "https://titleist.com/sitemap.xml": htmlResponse(
          `<sitemapindex><sitemap><loc>${productSitemap}</loc></sitemap></sitemapindex>`,
          200,
          "application/xml",
        ),
        [productSitemap]: htmlResponse(
          `<urlset><url><loc>${productUrl}</loc></url></urlset>`,
          200,
          "application/xml",
        ),
        "https://titleist.com/golf-clubs/drivers/": htmlResponse("shell"),
        [productUrl]: htmlResponse(productPage()),
      }) as typeof fetch,
    });
    expect(result.summary.sitemapsFetched).toBe(2);
    expect(result.summary.modelIdentitiesExtracted).toBe(1);
  });

  it("uses an official-domain search result after a 403 direct fetch", async () => {
    const pageUrl = "https://www.titleist.com/golf-clubs/drivers/gt3";
    const provider = searchProvider([pageUrl]);
    const fetchMock = fetchFrom({
      "https://titleist.com/sitemap.xml": htmlResponse("blocked", 403),
      "https://titleist.com/golf-clubs/drivers/": htmlResponse("blocked", 403),
      [pageUrl]: htmlResponse(productPage()),
    });
    const result = await run({
      fetchImpl: fetchMock as typeof fetch,
      searchProvider: provider,
    });
    expect(provider.discover).toHaveBeenCalledTimes(1);
    expect(result.summary.httpBlocked).toBe(2);
    expect(result.summary.searchFallbackCalls).toBe(1);
    expect(result.discoveries[0]?.decision).toBe("VERIFIED");
  });

  it("rejects search results outside the configured official domain", async () => {
    const provider = searchProvider([
      "https://titleist.com.evil.test/golf-clubs/drivers/fake",
    ]);
    const fetchMock = fetchFrom({
      "https://titleist.com/sitemap.xml": htmlResponse("not found", 404),
      "https://titleist.com/golf-clubs/drivers/": htmlResponse("shell"),
    });
    const result = await run({
      fetchImpl: fetchMock as typeof fetch,
      searchProvider: provider,
    });
    expect(result.summary.officialUrlsDiscovered).toBe(0);
    expect(result.summary.modelIdentitiesExtracted).toBe(0);
  });

  it("recognizes an existing canonical model without creating a candidate", async () => {
    const url = "https://titleist.com/golf-clubs/drivers/gt3";
    const result = await run({
      fetchImpl: fetchFrom({
        "https://titleist.com/sitemap.xml": htmlResponse(
          `<urlset><url><loc>${url}</loc></url></urlset>`,
          200,
          "application/xml",
        ),
        "https://titleist.com/golf-clubs/drivers/": htmlResponse("shell"),
        [url]: htmlResponse(productPage()),
      }) as typeof fetch,
      canonical: [
        {
          id: "model-id",
          brandId: brand.id,
          categoryId: driver.id,
          categorySlug: driver.slug,
          normalizedModelName: "gt3",
        },
      ],
    });
    expect(result.summary.existingModelsMatched).toBe(1);
    expect(result.summary.newCandidates).toBe(0);
    expect(result.discoveries[0]?.decision).toBe("EXISTING");
  });

  it("routes metadata-only product evidence to NEEDS_REVIEW", async () => {
    const url = "https://titleist.com/golf-clubs/drivers/gt4";
    const result = await run({
      fetchImpl: fetchFrom({
        "https://titleist.com/sitemap.xml": htmlResponse(
          `<urlset><url><loc>${url}</loc></url></urlset>`,
          200,
          "application/xml",
        ),
        "https://titleist.com/golf-clubs/drivers/": htmlResponse("shell"),
        [url]: htmlResponse("<title>Titleist GT4 Driver | Golf Clubs</title>"),
      }) as typeof fetch,
    });
    expect(result.discoveries[0]?.decision).toBe("NEEDS_REVIEW");
    expect(result.summary.needsReview).toBe(1);
  });

  it("is idempotent after a verified candidate becomes canonical", async () => {
    const url = "https://titleist.com/golf-clubs/drivers/gt5";
    const entries = {
      "https://titleist.com/sitemap.xml": () =>
        htmlResponse(
          `<urlset><url><loc>${url}</loc></url></urlset>`,
          200,
          "application/xml",
        ),
      "https://titleist.com/golf-clubs/drivers/": () => htmlResponse("shell"),
      [url]: () => htmlResponse(productPage("Titleist GT5 Driver")),
    };
    const first = await run({ fetchImpl: fetchFrom(entries) as typeof fetch });
    expect(first.discoveries[0]?.decision).toBe("VERIFIED");
    const second = await run({
      fetchImpl: fetchFrom(entries) as typeof fetch,
      canonical: [
        {
          id: "promoted-id",
          brandId: brand.id,
          categoryId: driver.id,
          categorySlug: driver.slug,
          normalizedModelName: "gt5",
        },
      ],
    });
    expect(second.discoveries[0]?.decision).toBe("EXISTING");
  });

  it("bounds search results and official product fetches", async () => {
    const urls = ["one", "two", "three"].map(
      (name) => `https://titleist.com/golf-clubs/drivers/${name}`,
    );
    const provider = searchProvider(urls);
    const fetchMock = fetchFrom({
      "https://titleist.com/sitemap.xml": htmlResponse("not found", 404),
      "https://titleist.com/golf-clubs/drivers/": htmlResponse("shell"),
      [urls[0]!]: htmlResponse(productPage("Titleist One Driver")),
      [urls[1]!]: htmlResponse(productPage("Titleist Two Driver")),
      [urls[2]!]: htmlResponse(productPage("Titleist Three Driver")),
    });
    const result = await run({
      fetchImpl: fetchMock as typeof fetch,
      searchProvider: provider,
    });
    expect(result.summary.officialUrlsDiscovered).toBe(2);
    expect(result.summary.modelIdentitiesExtracted).toBe(2);
    expect(fetchMock).not.toHaveBeenCalledWith(urls[2], expect.anything());
  });

  it("deduplicates the same normalized identity from two official pages", async () => {
    const first = "https://titleist.com/golf-clubs/drivers/gt3-a";
    const second = "https://titleist.com/golf-clubs/drivers/gt3-b";
    const result = await run({
      fetchImpl: fetchFrom({
        "https://titleist.com/sitemap.xml": htmlResponse(
          `<urlset><url><loc>${first}</loc></url><url><loc>${second}</loc></url></urlset>`,
          200,
          "application/xml",
        ),
        "https://titleist.com/golf-clubs/drivers/": htmlResponse("shell"),
        [first]: htmlResponse(productPage()),
        [second]: htmlResponse(productPage()),
      }) as typeof fetch,
    });
    expect(result.summary.modelIdentitiesExtracted).toBe(1);
    expect(result.summary.duplicates).toBe(1);
  });

  it("isolates category failure and reports partial brand success", async () => {
    const iron = { ...GOLF_REFERENCE_CATEGORIES[3], id: "iron-id" };
    const productUrl = "https://titleist.com/golf-clubs/drivers/gt3";
    const result = await run({
      categories: [driver, iron],
      fetchImpl: fetchFrom({
        "https://titleist.com/sitemap.xml": htmlResponse("not found", 404),
        "https://titleist.com/golf-clubs/drivers/": htmlResponse(
          `<a href="${productUrl}">GT3</a>`,
        ),
        [productUrl]: htmlResponse(productPage()),
        "https://titleist.com/golf-clubs/irons/": htmlResponse("blocked", 403),
      }) as typeof fetch,
    });
    expect(result.brands[0]?.status).toBe("PARTIAL");
    expect(result.summary.brandsPartial).toBe(1);
    expect(result.summary.categoriesSuccessful).toBe(1);
    expect(result.summary.categoriesFailed).toBe(1);
    expect(result.summary.notFound).toBe(1);
  });

  it("classifies timeout, 403, and 429 attempts without throwing", async () => {
    const timeoutFetch = vi.fn(async () => {
      throw new DOMException("timed out", "TimeoutError");
    });
    const timeoutResult = await run({
      fetchImpl: timeoutFetch as typeof fetch,
    });
    expect(timeoutResult.summary.timeouts).toBe(2);

    const blockedResult = await run({
      fetchImpl: fetchFrom({
        "https://titleist.com/sitemap.xml": htmlResponse("blocked", 403),
        "https://titleist.com/golf-clubs/drivers/": htmlResponse("limited", 429),
      }) as typeof fetch,
    });
    expect(blockedResult.summary.httpBlocked).toBe(1);
    expect(blockedResult.summary.rateLimits).toBe(1);
  });

  it("classifies an anti-bot redirect as HTTP_BLOCKED", async () => {
    const challenge = () =>
      new Response(null, {
        status: 302,
        headers: {
          location:
            "https://titleist.com/on/demandware.store/DDUser-Challenge",
        },
      });
    const result = await run({
      fetchImpl: fetchFrom({
        "https://titleist.com/sitemap.xml": challenge,
        "https://titleist.com/golf-clubs/drivers/": challenge,
      }) as typeof fetch,
    });
    expect(result.summary.httpBlocked).toBe(2);
    expect(result.diagnostics.every((item) => item.redirectCount === 1)).toBe(
      true,
    );
  });
});
