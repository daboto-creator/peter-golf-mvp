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
}) {
  return runGolfReferenceDiscovery({
    brands: [{ ...brand, ...input.brandOverride }],
    categories: [driver],
    canonicalModels: input.canonical ?? [],
    fetchImpl: input.fetchImpl,
    searchProvider: input.searchProvider,
    force: true,
    limits: {
      maxBrands: 1,
      maxCategoriesPerBrand: 1,
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
});
