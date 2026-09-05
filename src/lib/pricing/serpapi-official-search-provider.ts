import "server-only";

import { z } from "zod";

import type {
  FetchDiagnostic,
  OfficialSearchProvider,
} from "@/lib/catalog/golf-reference-discovery";

const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";

const responseSchema = z.object({
  organic_results: z
    .array(
      z.object({
        link: z.string().optional(),
      }),
    )
    .optional(),
  error: z.string().optional(),
});

export class SerpApiOfficialSearchProvider implements OfficialSearchProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 8_000,
  ) {
    if (!apiKey.trim()) throw new Error("SERPAPI_API_KEY no está configurada.");
  }

  async discover(input: Parameters<OfficialSearchProvider["discover"]>[0]) {
    const url = new URL(SERPAPI_ENDPOINT);
    url.search = new URLSearchParams({
      engine: "google",
      q: `${input.brand} ${input.category.name} site:${input.officialDomain}`,
      num: String(Math.max(1, Math.min(input.limit, 5))),
      gl: "us",
      hl: "en",
      safe: "active",
      api_key: this.apiKey,
    }).toString();
    const diagnostic: FetchDiagnostic = {
      brand: input.brand,
      category: input.category.name,
      requestedHostname: url.hostname,
      requestedPath: url.pathname,
      strategy: "SEARCH_PROVIDER",
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
    try {
      const response = await this.fetchImpl(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: { Accept: "application/json" },
      });
      diagnostic.httpStatus = response.status;
      diagnostic.contentType = response.headers.get("content-type");
      diagnostic.blocked = response.status === 401 || response.status === 403;
      diagnostic.notFound = response.status === 404;
      diagnostic.rateLimited = response.status === 429;
      diagnostic.serverError = response.status >= 500;
      const raw = await response.text();
      diagnostic.responseBytes = new TextEncoder().encode(raw).byteLength;
      if (diagnostic.blocked) diagnostic.failureClass = "HTTP_BLOCKED";
      else if (diagnostic.rateLimited) diagnostic.failureClass = "RATE_LIMITED";
      else if (diagnostic.notFound) diagnostic.failureClass = "NOT_FOUND";
      else if (diagnostic.serverError) diagnostic.failureClass = "HTTP_5XX";
      else if (!response.ok)
        diagnostic.failureClass = "UNSUPPORTED_SOURCE_STRUCTURE";
      if (diagnostic.failureClass) return { urls: [], diagnostic };
      let payload: unknown;
      try {
        payload = JSON.parse(raw);
      } catch {
        diagnostic.parseError = true;
        diagnostic.failureClass = "PARSER_FAILURE";
        return { urls: [], diagnostic };
      }
      const parsed = responseSchema.safeParse(payload);
      if (!parsed.success || parsed.data.error) {
        diagnostic.parseError = true;
        diagnostic.failureClass = "PARSER_FAILURE";
        return { urls: [], diagnostic };
      }
      return {
        urls: (parsed.data.organic_results ?? [])
          .flatMap((result) => (result.link ? [result.link] : []))
          .slice(0, input.limit),
        diagnostic,
      };
    } catch (error) {
      const name = String((error as { name?: unknown })?.name ?? "");
      const code = String(
        (error as { cause?: { code?: unknown } })?.cause?.code ?? "",
      );
      diagnostic.timeout = name === "TimeoutError" || name === "AbortError";
      diagnostic.tlsError = /TLS|CERT|SSL/i.test(code) ? code : null;
      diagnostic.networkError = diagnostic.timeout
        ? null
        : (code || "FETCH_FAILED").slice(0, 80);
      diagnostic.failureClass = diagnostic.timeout
        ? "TIMEOUT"
        : "NETWORK_ERROR";
      return { urls: [], diagnostic };
    }
  }
}
