export const GOLF_REFERENCE_CATEGORIES = [
  { name: "Driver", slug: "driver", terms: ["driver", "drivers"] },
  {
    name: "Fairway Wood",
    slug: "fairway-wood",
    terms: ["fairway", "fairways", "fairway-wood", "fairway-woods"],
  },
  { name: "Hybrid", slug: "hybrid", terms: ["hybrid", "hybrids", "rescue"] },
  { name: "Iron", slug: "iron", terms: ["iron", "irons"] },
  { name: "Wedge", slug: "wedge", terms: ["wedge", "wedges"] },
  { name: "Putter", slug: "putter", terms: ["putter", "putters"] },
] as const;

export type GolfReferenceCategory = (typeof GOLF_REFERENCE_CATEGORIES)[number];

export type DiscoveryFailureClass =
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "HTTP_BLOCKED"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "HTTP_5XX"
  | "NON_HTML_RESPONSE"
  | "JS_RENDERED_NO_PRODUCT_DATA"
  | "NO_JSON_LD"
  | "NO_PRODUCT_LINKS"
  | "PARSER_FAILURE"
  | "UNSUPPORTED_SOURCE_STRUCTURE";

export type DiscoveryStrategy =
  | "KNOWN_CATEGORY_PAGE"
  | "SITEMAP"
  | "SITEMAP_INDEX"
  | "SEARCH_PROVIDER"
  | "OFFICIAL_PRODUCT_PAGE";

export type FetchDiagnostic = {
  brand: string;
  category: string | null;
  requestedHostname: string;
  requestedPath: string;
  strategy: DiscoveryStrategy;
  httpStatus: number | null;
  contentType: string | null;
  responseBytes: number;
  redirectCount: number;
  timeout: boolean;
  networkError: string | null;
  tlsError: string | null;
  blocked: boolean;
  notFound: boolean;
  rateLimited: boolean;
  serverError: boolean;
  robotsBlock: boolean;
  htmlNoProducts: boolean;
  jsonLdFound: boolean;
  sitemapFound: boolean;
  parseError: boolean;
  failureClass: DiscoveryFailureClass | null;
};

export type OfficialSearchProvider = {
  discover(input: {
    brand: string;
    category: GolfReferenceCategory;
    officialDomain: string;
    limit: number;
  }): Promise<{ urls: string[]; diagnostic: FetchDiagnostic }>;
};

export type DiscoveryBrand = {
  id: string;
  name: string;
  slug: string;
  officialDomain: string;
  lastVerifiedAt?: string | null;
};

export type CanonicalGolfModel = {
  id: string;
  brandId: string;
  categoryId: string;
  categorySlug: string;
  normalizedModelName: string;
};

export type DiscoveredGolfModel = {
  brandId: string;
  brandName: string;
  brandKey: string;
  categoryId: string;
  categorySlug: string;
  modelName: string;
  normalizedModelName: string;
  sourceUrl: string;
  evidence: Record<string, unknown>;
  decision: "EXISTING" | "VERIFIED" | "NEEDS_REVIEW";
  canonicalId: string | null;
};

export type BrandDiscoveryResult = {
  brand: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED_FRESH";
  officialUrlsDiscovered: number;
  pagesParsed: number;
  modelIdentities: string[];
  existingModelsMatched: number;
  newCandidates: number;
  needsReview: number;
  failures: Partial<Record<DiscoveryFailureClass, number>>;
  categories: Array<{
    category: string;
    status: "SUCCESS" | "FAILED" | "NO_RESULTS";
    urlsDiscovered: number;
    pagesParsed: number;
    modelsExtracted: number;
    failureClasses: DiscoveryFailureClass[];
  }>;
};

export type DiscoveryRunResult = {
  diagnostics: FetchDiagnostic[];
  discoveries: DiscoveredGolfModel[];
  brands: BrandDiscoveryResult[];
  summary: {
    brandsAttempted: number;
    brandsSuccessful: number;
    brandsFailed: number;
    brandsSkippedFresh: number;
    fetchAttempts: number;
    httpSuccesses: number;
    httpBlocked: number;
    timeouts: number;
    rateLimits: number;
    parseFailures: number;
    networkErrors: number;
    officialUrlsDiscovered: number;
    pagesParsed: number;
    modelIdentitiesExtracted: number;
    existingModelsMatched: number;
    newCandidates: number;
    needsReview: number;
    duplicates: number;
  };
};

type DiscoveryInput = {
  brands: DiscoveryBrand[];
  categories: Array<GolfReferenceCategory & { id: string }>;
  canonicalModels: CanonicalGolfModel[];
  fetchImpl?: typeof fetch;
  searchProvider?: OfficialSearchProvider | null;
  force?: boolean;
  now?: Date;
  limits?: Partial<typeof DEFAULT_LIMITS>;
};

const DEFAULT_LIMITS = {
  maxBrands: 30,
  maxCategoriesPerBrand: 6,
  maxSearchResultsPerCategory: 5,
  maxProductPagesPerCategory: 2,
  maxSitemapChildren: 3,
  maxSitemapUrls: 500,
  maxSearchCallsPerRun: 36,
  requestTimeoutMs: 8_000,
  freshnessDays: 21,
};

const CATEGORY_PATH_HINTS: Record<string, Partial<Record<string, string>>> = {
  titleist: {
    driver: "/golf-clubs/drivers/",
    "fairway-wood": "/golf-clubs/fairways/",
    hybrid: "/golf-clubs/hybrids/",
    iron: "/golf-clubs/irons/",
    wedge: "/golf-clubs/wedges/",
    putter: "/golf-clubs/putters/",
  },
  taylormade: {
    driver: "/collections/drivers",
    "fairway-wood": "/collections/fairways",
    hybrid: "/collections/rescues",
    iron: "/collections/irons",
    wedge: "/collections/wedges",
    putter: "/collections/putters",
  },
  callaway: {
    driver: "/golf-clubs/drivers/",
    "fairway-wood": "/golf-clubs/fairway-woods/",
    hybrid: "/golf-clubs/hybrids/",
    iron: "/golf-clubs/irons/",
    wedge: "/golf-clubs/wedges/",
    putter: "/golf-clubs/putters/",
  },
  ping: {
    driver: "/en-us/clubs/drivers",
    "fairway-wood": "/en-us/clubs/fairways",
    hybrid: "/en-us/clubs/hybrids",
    iron: "/en-us/clubs/irons",
    wedge: "/en-us/clubs/wedges",
    putter: "/en-us/clubs/putters",
  },
  cobra: {
    driver: "/collections/golf-clubs-drivers",
    "fairway-wood": "/collections/golf-clubs-fairways",
    hybrid: "/collections/golf-clubs-hybrids",
    iron: "/collections/golf-clubs-irons",
    wedge: "/collections/golf-clubs-wedges",
    putter: "/collections/golf-clubs-putters",
  },
};

const BLOCK_PAGE_PATTERN =
  /access denied|request blocked|verify you are human|captcha challenge|bot protection/i;
const TLS_CODE_PATTERN = /TLS|CERT|SSL/i;
const GENERIC_MODEL_PATTERN =
  /^(?:shop\s+)?(?:men'?s\s+|women'?s\s+)?(?:golf\s+)?(?:clubs?|drivers?|fairways?|fairway woods?|hybrids?|rescues?|irons?|wedges?|putters?|products?|collections?|logo)$/i;
const CONFIGURATION_SUFFIX_PATTERN =
  /(?:\s+|[-–|,])(\d{1,2}(?:\.\d)?°|\d{1,2}(?:\.\d)?\s*(?:degree|degrees)|RH|LH|right hand|left hand|regular|stiff|x-?stiff|senior|ladies)(?=\s|$)/gi;

export function normalizeBrandKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function normalizeModelIdentity(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(CONFIGURATION_SUFFIX_PATTERN, " ")
    .toLowerCase()
    .replace(
      /\b(?:driver|fairway woods?|fairways?|hybrids?|irons?|wedges?|putters?)\b/g,
      " ",
    )
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function cleanModelName(value: string, brand: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&(?:ndash|mdash);/gi, "-")
    .replace(new RegExp(escapeRegExp(brand), "ig"), " ")
    .replace(CONFIGURATION_SUFFIX_PATTERN, " ")
    .replace(
      /\s*[|–—]\s*(?:golf clubs?|drivers?|fairways?|hybrids?|irons?|wedges?|putters?).*$/i,
      " ",
    )
    .replace(
      /\b(?:driver|fairway woods?|fairways?|hybrids?|rescues?|irons?|wedges?|putters?)\b/gi,
      " ",
    )
    .replace(/\b(?:buy|shop|customize)\b/gi, " ")
    .replace(/\s*[-|]\s*golf\s*$/i, " ")
    .replace(/\s*[|–—-]\s*$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isOfficialDomainUrl(value: string, domain: string): boolean {
  try {
    const hostname = new URL(value).hostname
      .toLowerCase()
      .replace(/^www\./, "");
    const expected = domain.toLowerCase().replace(/^www\./, "");
    return hostname === expected || hostname.endsWith(`.${expected}`);
  } catch {
    return false;
  }
}

function classifyCategory(
  value: string,
  expected: GolfReferenceCategory,
): boolean {
  const normalized = value.toLowerCase().replace(/[_\s]+/g, "-");
  return expected.terms.some((term) => normalized.includes(term));
}

function isLikelyProductUrl(url: string, category: GolfReferenceCategory) {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const decodedPath = decodeURIComponent(parsed.pathname).toLowerCase();
    const last = decodeURIComponent(segments.at(-1) ?? "").replace(
      /[-_]+/g,
      " ",
    );
    const lowerSegments = segments.map((segment) => segment.toLowerCase());
    const categoryIndex = lowerSegments.findIndex((segment) =>
      category.terms.some((term) => segment === term),
    );
    const hasProductContainer = lowerSegments.some((segment) =>
      /^(?:product|products)$/.test(segment),
    );
    const hasCategoryDetail =
      categoryIndex >= 0 && categoryIndex < lowerSegments.length - 1;
    const hasCommerceCloudDetail =
      /\.html$/i.test(parsed.pathname) &&
      /(?:\/[^/]*(?:driver|fairway|hybrid|rescue|iron|wedge|putter)[^/]*\/|\/[^/]+\.html$)/i.test(
        parsed.pathname,
      );
    return (
      segments.length >= 2 &&
      classifyCategory(parsed.pathname, category) &&
      last.length >= 2 &&
      !GENERIC_MODEL_PATTERN.test(last) &&
      !lowerSegments.includes("collections") &&
      !/(?:newsroom|teamtitleist|golf-guides|buying-guide|category-landings|banner-asset)/i.test(
        decodedPath,
      ) &&
      !/(?:headcover|hosel-adapter|shaft|replacement-grip|golf-bag|apparel|weights?)/i.test(
        decodedPath,
      ) &&
      (hasProductContainer || hasCategoryDetail || hasCommerceCloudDetail)
    );
  } catch {
    return false;
  }
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function parseLinks(html: string, base: string): string[] {
  const links: string[] = [];
  for (const match of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    try {
      links.push(new URL(match[1]!, base).toString());
    } catch {
      // Ignore malformed page-owned links.
    }
  }
  return unique(links);
}

function parseSitemapLocations(xml: string): string[] {
  return unique(
    [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) =>
      match[1]!.replace(/&amp;/g, "&").trim(),
    ),
  );
}

type FetchResult = {
  body: string | null;
  finalUrl: string | null;
  diagnostic: FetchDiagnostic;
};

async function fetchOfficialResource(input: {
  brand: string;
  category: string | null;
  url: string;
  officialDomain: string;
  strategy: DiscoveryStrategy;
  fetchImpl: typeof fetch;
  timeoutMs: number;
}): Promise<FetchResult> {
  const requested = new URL(input.url);
  const diagnostic: FetchDiagnostic = {
    brand: input.brand,
    category: input.category,
    requestedHostname: requested.hostname,
    requestedPath: requested.pathname,
    strategy: input.strategy,
    httpStatus: null,
    contentType: null,
    responseBytes: 0,
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
  if (!isOfficialDomainUrl(input.url, input.officialDomain)) {
    diagnostic.failureClass = "HTTP_BLOCKED";
    diagnostic.blocked = true;
    return { body: null, finalUrl: null, diagnostic };
  }
  try {
    let response: Response | null = null;
    let currentUrl = input.url;
    const visited = new Set<string>();
    for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
      if (visited.has(currentUrl)) {
        diagnostic.failureClass = "UNSUPPORTED_SOURCE_STRUCTURE";
        return { body: null, finalUrl: null, diagnostic };
      }
      visited.add(currentUrl);
      response = await input.fetchImpl(currentUrl, {
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(input.timeoutMs),
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml,text/xml",
          "User-Agent": "BestRoundGolfReferenceBot/1.0",
        },
      });
      const location = response.headers.get("location");
      if (response.status < 300 || response.status >= 400 || !location) break;
      const redirectedUrl = new URL(location, currentUrl).toString();
      diagnostic.redirectCount += 1;
      if (!isOfficialDomainUrl(redirectedUrl, input.officialDomain)) {
        diagnostic.blocked = true;
        diagnostic.failureClass = "HTTP_BLOCKED";
        return { body: null, finalUrl: null, diagnostic };
      }
      currentUrl = redirectedUrl;
      response = null;
    }
    if (!response) {
      diagnostic.failureClass = "UNSUPPORTED_SOURCE_STRUCTURE";
      return { body: null, finalUrl: null, diagnostic };
    }
    diagnostic.httpStatus = response.status;
    diagnostic.contentType = response.headers.get("content-type");
    diagnostic.blocked = response.status === 401 || response.status === 403;
    diagnostic.notFound = response.status === 404;
    diagnostic.rateLimited = response.status === 429;
    diagnostic.serverError = response.status >= 500;
    if (
      !isOfficialDomainUrl(response.url || currentUrl, input.officialDomain)
    ) {
      diagnostic.blocked = true;
      diagnostic.failureClass = "HTTP_BLOCKED";
      return { body: null, finalUrl: null, diagnostic };
    }
    const body = (await response.text()).slice(0, 750_000);
    diagnostic.responseBytes = new TextEncoder().encode(body).byteLength;
    diagnostic.robotsBlock = BLOCK_PAGE_PATTERN.test(body);
    diagnostic.jsonLdFound =
      /<script[^>]+type=["']application\/ld\+json["']/i.test(body);
    diagnostic.sitemapFound = /<(?:urlset|sitemapindex)\b/i.test(body);
    if (diagnostic.blocked || diagnostic.robotsBlock)
      diagnostic.failureClass = "HTTP_BLOCKED";
    else if (diagnostic.rateLimited) diagnostic.failureClass = "RATE_LIMITED";
    else if (diagnostic.notFound) diagnostic.failureClass = "NOT_FOUND";
    else if (diagnostic.serverError) diagnostic.failureClass = "HTTP_5XX";
    else if (!response.ok)
      diagnostic.failureClass = "UNSUPPORTED_SOURCE_STRUCTURE";
    else if (
      input.strategy !== "SITEMAP" &&
      input.strategy !== "SITEMAP_INDEX" &&
      !diagnostic.contentType?.toLowerCase().includes("html")
    )
      diagnostic.failureClass = "NON_HTML_RESPONSE";
    return {
      body: response.ok && !diagnostic.failureClass ? body : null,
      finalUrl: response.url || currentUrl,
      diagnostic,
    };
  } catch (error) {
    const name = String((error as { name?: unknown })?.name ?? "");
    const cause = (error as { cause?: { code?: unknown } })?.cause;
    const code = String(cause?.code ?? "");
    diagnostic.timeout = name === "TimeoutError" || name === "AbortError";
    diagnostic.tlsError = TLS_CODE_PATTERN.test(code) ? code : null;
    diagnostic.networkError = diagnostic.timeout
      ? null
      : (code || "FETCH_FAILED").slice(0, 80);
    diagnostic.failureClass = diagnostic.timeout ? "TIMEOUT" : "NETWORK_ERROR";
    return { body: null, finalUrl: null, diagnostic };
  }
}

type ExtractedIdentity = {
  modelName: string;
  normalizedModelName: string;
  confidence: "HIGH" | "MEDIUM";
};

function walkJsonLd(
  value: unknown,
  visit: (record: Record<string, unknown>) => void,
) {
  if (Array.isArray(value)) {
    value.forEach((item) => walkJsonLd(item, visit));
    return;
  }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  visit(record);
  if (record["@graph"]) walkJsonLd(record["@graph"], visit);
}

export function extractOfficialProductIdentity(input: {
  html: string;
  url: string;
  brand: string;
  category: GolfReferenceCategory;
}): { identities: ExtractedIdentity[]; parseError: boolean } {
  const identities: ExtractedIdentity[] = [];
  let parseError = false;
  const add = (raw: string, confidence: "HIGH" | "MEDIUM") => {
    const modelName = cleanModelName(raw, input.brand);
    const normalizedModelName = normalizeModelIdentity(modelName);
    if (
      modelName.length < 2 ||
      modelName.length > 100 ||
      normalizedModelName.length < 1 ||
      GENERIC_MODEL_PATTERN.test(modelName) ||
      !classifyCategory(`${raw} ${input.url}`, input.category)
    )
      return;
    if (
      !identities.some(
        (item) => item.normalizedModelName === normalizedModelName,
      )
    )
      identities.push({ modelName, normalizedModelName, confidence });
  };
  for (const match of input.html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      walkJsonLd(JSON.parse(match[1]!), (record) => {
        const type = record["@type"];
        const types = Array.isArray(type)
          ? type.map(String)
          : [String(type ?? "")];
        if (!types.some((item) => item.toLowerCase() === "product")) return;
        const name = typeof record.name === "string" ? record.name : "";
        const brandValue = record.brand;
        const statedBrand =
          typeof brandValue === "string"
            ? brandValue
            : brandValue && typeof brandValue === "object"
              ? String((brandValue as Record<string, unknown>).name ?? "")
              : "";
        if (
          normalizeBrandKey(statedBrand || name) !==
            normalizeBrandKey(input.brand) &&
          !normalizeBrandKey(name).startsWith(normalizeBrandKey(input.brand))
        )
          return;
        add(name, "HIGH");
      });
    } catch {
      parseError = true;
    }
  }
  if (!identities.length && isLikelyProductUrl(input.url, input.category)) {
    const metadata = [
      ...input.html.matchAll(
        /<meta[^>]+(?:property|name)=["'](?:og:title|twitter:title)["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
      ),
      ...input.html.matchAll(/<title[^>]*>([^<]+)<\/title>/gi),
    ];
    for (const match of metadata) {
      const raw = match[1]!.replace(/<[^>]+>/g, " ");
      if (
        !identities.length &&
        normalizeBrandKey(raw).includes(normalizeBrandKey(input.brand))
      )
        add(raw, "MEDIUM");
    }
  }
  return { identities, parseError };
}

function incrementFailure(
  target: Partial<Record<DiscoveryFailureClass, number>>,
  failure: DiscoveryFailureClass | null,
) {
  if (failure) target[failure] = (target[failure] ?? 0) + 1;
}

function isFresh(
  lastVerifiedAt: string | null | undefined,
  now: Date,
  days: number,
) {
  if (!lastVerifiedAt) return false;
  const timestamp = Date.parse(lastVerifiedAt);
  return (
    Number.isFinite(timestamp) && now.getTime() - timestamp < days * 86_400_000
  );
}

export async function runGolfReferenceDiscovery(
  input: DiscoveryInput,
): Promise<DiscoveryRunResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const limits = { ...DEFAULT_LIMITS, ...input.limits };
  const now = input.now ?? new Date();
  const diagnostics: FetchDiagnostic[] = [];
  const discoveries: DiscoveredGolfModel[] = [];
  const brandResults: BrandDiscoveryResult[] = [];
  let duplicates = 0;
  let searchCalls = 0;
  const seenIdentities = new Set<string>();
  const canonicalByKey = new Map(
    input.canonicalModels.map((model) => [
      `${model.brandId}:${model.categoryId}:${model.normalizedModelName}`,
      model,
    ]),
  );

  for (const brand of input.brands.slice(0, limits.maxBrands)) {
    const brandResult: BrandDiscoveryResult = {
      brand: brand.name,
      status: "FAILED",
      officialUrlsDiscovered: 0,
      pagesParsed: 0,
      modelIdentities: [],
      existingModelsMatched: 0,
      newCandidates: 0,
      needsReview: 0,
      failures: {},
      categories: [],
    };
    if (
      !input.force &&
      isFresh(brand.lastVerifiedAt, now, limits.freshnessDays)
    ) {
      brandResult.status = "SKIPPED_FRESH";
      brandResults.push(brandResult);
      continue;
    }

    const sitemapUrls: string[] = [];
    const sitemap = await fetchOfficialResource({
      brand: brand.name,
      category: null,
      url: `https://${brand.officialDomain}/sitemap.xml`,
      officialDomain: brand.officialDomain,
      strategy: "SITEMAP",
      fetchImpl,
      timeoutMs: limits.requestTimeoutMs,
    });
    diagnostics.push(sitemap.diagnostic);
    incrementFailure(brandResult.failures, sitemap.diagnostic.failureClass);
    if (sitemap.body) {
      const locations = parseSitemapLocations(sitemap.body).slice(
        0,
        limits.maxSitemapUrls,
      );
      const children = locations.filter((url) => /\.xml(?:$|\?)/i.test(url));
      sitemapUrls.push(
        ...locations.filter((url) => !/\.xml(?:$|\?)/i.test(url)),
      );
      for (const childUrl of children.slice(0, limits.maxSitemapChildren)) {
        if (!isOfficialDomainUrl(childUrl, brand.officialDomain)) continue;
        const child = await fetchOfficialResource({
          brand: brand.name,
          category: null,
          url: childUrl,
          officialDomain: brand.officialDomain,
          strategy: "SITEMAP_INDEX",
          fetchImpl,
          timeoutMs: limits.requestTimeoutMs,
        });
        diagnostics.push(child.diagnostic);
        incrementFailure(brandResult.failures, child.diagnostic.failureClass);
        if (child.body)
          sitemapUrls.push(
            ...parseSitemapLocations(child.body).slice(
              0,
              limits.maxSitemapUrls,
            ),
          );
      }
    }

    for (const category of input.categories.slice(
      0,
      limits.maxCategoriesPerBrand,
    )) {
      const categoryFailures: DiscoveryFailureClass[] = [];
      const candidateUrls: string[] = [];
      const hint = CATEGORY_PATH_HINTS[brand.slug]?.[category.slug];
      if (hint) {
        const categoryPage = await fetchOfficialResource({
          brand: brand.name,
          category: category.name,
          url: new URL(hint, `https://${brand.officialDomain}`).toString(),
          officialDomain: brand.officialDomain,
          strategy: "KNOWN_CATEGORY_PAGE",
          fetchImpl,
          timeoutMs: limits.requestTimeoutMs,
        });
        diagnostics.push(categoryPage.diagnostic);
        incrementFailure(
          brandResult.failures,
          categoryPage.diagnostic.failureClass,
        );
        if (categoryPage.diagnostic.failureClass)
          categoryFailures.push(categoryPage.diagnostic.failureClass);
        if (categoryPage.body) {
          const links = parseLinks(categoryPage.body, categoryPage.finalUrl!);
          const productLinks = links.filter(
            (url) =>
              isOfficialDomainUrl(url, brand.officialDomain) &&
              isLikelyProductUrl(url, category),
          );
          candidateUrls.push(...productLinks);
          if (!productLinks.length) {
            categoryPage.diagnostic.htmlNoProducts = true;
            categoryPage.diagnostic.failureClass =
              categoryPage.diagnostic.responseBytes < 5_000
                ? "JS_RENDERED_NO_PRODUCT_DATA"
                : "NO_PRODUCT_LINKS";
            categoryFailures.push(categoryPage.diagnostic.failureClass);
            incrementFailure(
              brandResult.failures,
              categoryPage.diagnostic.failureClass,
            );
          }
        }
      }
      candidateUrls.push(
        ...sitemapUrls.filter(
          (url) =>
            isOfficialDomainUrl(url, brand.officialDomain) &&
            isLikelyProductUrl(url, category),
        ),
      );
      let urls = unique(candidateUrls);
      if (
        !urls.length &&
        input.searchProvider &&
        searchCalls < limits.maxSearchCallsPerRun
      ) {
        try {
          searchCalls += 1;
          const search = await input.searchProvider.discover({
            brand: brand.name,
            category,
            officialDomain: brand.officialDomain,
            limit: limits.maxSearchResultsPerCategory,
          });
          diagnostics.push(search.diagnostic);
          incrementFailure(
            brandResult.failures,
            search.diagnostic.failureClass,
          );
          if (search.diagnostic.failureClass)
            categoryFailures.push(search.diagnostic.failureClass);
          urls = unique(
            search.urls.filter(
              (url) =>
                isOfficialDomainUrl(url, brand.officialDomain) &&
                isLikelyProductUrl(url, category),
            ),
          );
        } catch {
          categoryFailures.push("NETWORK_ERROR");
          incrementFailure(brandResult.failures, "NETWORK_ERROR");
        }
      }
      const boundedUrls = urls.slice(0, limits.maxProductPagesPerCategory);
      brandResult.officialUrlsDiscovered += boundedUrls.length;
      let parsed = 0;
      let extracted = 0;
      for (const url of boundedUrls) {
        const page = await fetchOfficialResource({
          brand: brand.name,
          category: category.name,
          url,
          officialDomain: brand.officialDomain,
          strategy: "OFFICIAL_PRODUCT_PAGE",
          fetchImpl,
          timeoutMs: limits.requestTimeoutMs,
        });
        diagnostics.push(page.diagnostic);
        incrementFailure(brandResult.failures, page.diagnostic.failureClass);
        if (page.diagnostic.failureClass)
          categoryFailures.push(page.diagnostic.failureClass);
        if (!page.body || !page.finalUrl) continue;
        parsed += 1;
        brandResult.pagesParsed += 1;
        const extraction = extractOfficialProductIdentity({
          html: page.body,
          url: page.finalUrl,
          brand: brand.name,
          category,
        });
        page.diagnostic.parseError = extraction.parseError;
        if (extraction.parseError) {
          page.diagnostic.failureClass = "PARSER_FAILURE";
          categoryFailures.push("PARSER_FAILURE");
          incrementFailure(brandResult.failures, "PARSER_FAILURE");
        }
        if (!extraction.identities.length) {
          page.diagnostic.htmlNoProducts = true;
          page.diagnostic.failureClass = page.diagnostic.jsonLdFound
            ? "UNSUPPORTED_SOURCE_STRUCTURE"
            : "NO_JSON_LD";
          categoryFailures.push(page.diagnostic.failureClass);
          incrementFailure(brandResult.failures, page.diagnostic.failureClass);
        }
        for (const identity of extraction.identities) {
          const identityKey = `${brand.id}:${category.id}:${identity.normalizedModelName}`;
          if (seenIdentities.has(identityKey)) {
            duplicates += 1;
            continue;
          }
          seenIdentities.add(identityKey);
          extracted += 1;
          brandResult.modelIdentities.push(identity.modelName);
          const canonical = canonicalByKey.get(identityKey);
          const decision = canonical
            ? "EXISTING"
            : identity.confidence === "HIGH"
              ? "VERIFIED"
              : "NEEDS_REVIEW";
          if (canonical) brandResult.existingModelsMatched += 1;
          else brandResult.newCandidates += 1;
          if (decision === "NEEDS_REVIEW") brandResult.needsReview += 1;
          discoveries.push({
            brandId: brand.id,
            brandName: brand.name,
            brandKey: normalizeBrandKey(brand.slug),
            categoryId: category.id,
            categorySlug: category.slug,
            modelName: identity.modelName,
            normalizedModelName: identity.normalizedModelName,
            sourceUrl: page.finalUrl,
            decision,
            canonicalId: canonical?.id ?? null,
            evidence: {
              discoveredBy:
                identity.confidence === "HIGH"
                  ? "jsonld-product"
                  : "page-metadata",
              confidence: identity.confidence,
              officialDomain: brand.officialDomain,
              category: category.slug,
              fetchedAt: now.toISOString(),
            },
          });
        }
      }
      brandResult.categories.push({
        category: category.name,
        status:
          extracted > 0
            ? "SUCCESS"
            : boundedUrls.length || parsed
              ? "NO_RESULTS"
              : "FAILED",
        urlsDiscovered: boundedUrls.length,
        pagesParsed: parsed,
        modelsExtracted: extracted,
        failureClasses: unique(categoryFailures),
      });
    }
    brandResult.modelIdentities = unique(brandResult.modelIdentities);
    brandResult.status =
      brandResult.existingModelsMatched > 0 || brandResult.newCandidates > 0
        ? "SUCCESS"
        : "FAILED";
    brandResults.push(brandResult);
  }

  return {
    diagnostics,
    discoveries,
    brands: brandResults,
    summary: {
      brandsAttempted: brandResults.filter(
        (brand) => brand.status !== "SKIPPED_FRESH",
      ).length,
      brandsSuccessful: brandResults.filter(
        (brand) => brand.status === "SUCCESS",
      ).length,
      brandsFailed: brandResults.filter((brand) => brand.status === "FAILED")
        .length,
      brandsSkippedFresh: brandResults.filter(
        (brand) => brand.status === "SKIPPED_FRESH",
      ).length,
      fetchAttempts: diagnostics.length,
      httpSuccesses: diagnostics.filter(
        (item) =>
          item.httpStatus && item.httpStatus >= 200 && item.httpStatus < 300,
      ).length,
      httpBlocked: diagnostics.filter(
        (item) => item.blocked || item.robotsBlock,
      ).length,
      timeouts: diagnostics.filter((item) => item.timeout).length,
      rateLimits: diagnostics.filter((item) => item.rateLimited).length,
      parseFailures: diagnostics.filter((item) => item.parseError).length,
      networkErrors: diagnostics.filter(
        (item) => item.failureClass === "NETWORK_ERROR",
      ).length,
      officialUrlsDiscovered: brandResults.reduce(
        (sum, brand) => sum + brand.officialUrlsDiscovered,
        0,
      ),
      pagesParsed: brandResults.reduce(
        (sum, brand) => sum + brand.pagesParsed,
        0,
      ),
      modelIdentitiesExtracted: discoveries.length,
      existingModelsMatched: discoveries.filter(
        (item) => item.decision === "EXISTING",
      ).length,
      newCandidates: discoveries.filter((item) => item.decision !== "EXISTING")
        .length,
      needsReview: discoveries.filter(
        (item) => item.decision === "NEEDS_REVIEW",
      ).length,
      duplicates,
    },
  };
}
