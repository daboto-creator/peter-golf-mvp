import "server-only";

import { z } from "zod";

import type {
  MarketPriceInput,
  MarketPriceProvider,
  MarketPriceResult,
} from "@/lib/pricing/market-price-provider";
import type { RawMarketComparable } from "@/lib/pricing/market-price-matching";
import { buildMarketPriceResult } from "@/lib/pricing/market-price-statistics";
import { ceilDivide } from "@/lib/pricing/money";

const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";
const DEFAULT_TIMEOUT_MS = 10_000;

const shoppingItemSchema = z.object({
  title: z.string().min(1),
  source: z.string().optional(),
  price: z.string().optional(),
  extracted_price: z.union([z.number(), z.string()]).optional(),
  product_id: z.union([z.string(), z.number()]).optional(),
  product_link: z.string().optional(),
  link: z.string().optional(),
  delivery: z.string().optional(),
  second_hand_condition: z.string().optional(),
  snippet: z.string().optional(),
  extensions: z.array(z.string()).optional(),
  installment: z.unknown().optional(),
});

const responseSchema = z.object({
  shopping_results: z.array(shoppingItemSchema).optional(),
  inline_shopping_results: z.array(shoppingItemSchema).optional(),
  error: z.string().optional(),
});

function parseDecimalToMinorUnits(value: string): number | null {
  const normalized = value.trim().replace(/,/g, "");
  const match = normalized.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) return null;
  const fraction = `${match[2] ?? ""}00`.slice(0, 2);
  const minor = BigInt(match[1]) * BigInt(100) + BigInt(fraction);
  const result = Number(minor);
  return Number.isSafeInteger(result) && result > 0 ? result : null;
}

function conditionFrom(item: z.infer<typeof shoppingItemSchema>) {
  const value =
    `${item.second_hand_condition ?? ""} ${item.title}`.toLowerCase();
  if (/refurbished|reacondicionado/.test(value)) return "refurbished" as const;
  if (/used|pre.?owned|segunda mano|seminuevo|usado/.test(value))
    return "used" as const;
  return item.second_hand_condition ? ("unknown" as const) : ("new" as const);
}

function availabilityFrom(item: z.infer<typeof shoppingItemSchema>) {
  const value = [item.delivery, item.snippet, ...(item.extensions ?? [])]
    .join(" ")
    .toLowerCase();
  if (/out of stock|agotado|sin existencias/.test(value))
    return "out_of_stock" as const;
  if (/in stock|disponible|en existencia|entrega/.test(value))
    return "in_stock" as const;
  return "unknown" as const;
}

function safeSourceUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function marketScopeFrom(item: z.infer<typeof shoppingItemSchema>) {
  const merchant = item.source?.toLowerCase() ?? "";
  const title = item.title.toLowerCase();
  const sourceUrl = safeSourceUrl(item.link ?? item.product_link);
  const hostname = sourceUrl ? new URL(sourceUrl).hostname.toLowerCase() : "";
  if (hostname.endsWith(".mx") || /mexico|méxico/.test(merchant)) {
    return "mexico" as const;
  }
  if (
    /ebay|desertcart/.test(merchant) ||
    /japon|japón|japan|\bjp\b/.test(title) ||
    (/\.[a-z]{2}$/.test(hostname) && !hostname.endsWith(".mx"))
  ) {
    return "international" as const;
  }
  return "unknown" as const;
}

export function buildMarketSearchQuery(input: MarketPriceInput): string {
  const type =
    input.clubType?.replaceAll("_", " ") ??
    input.setType?.replaceAll("_", " ") ??
    input.bagType?.replaceAll("_", " ") ??
    input.productFamily;
  return [
    input.brand,
    input.model,
    input.modelYear,
    type,
    input.clubNumber,
    input.loftDegrees === null ? null : `${input.loftDegrees} grados`,
    input.handedness,
    input.shaftModel,
    input.shaftFlex,
    input.condition === "used" ? "seminuevo" : "nuevo",
    "México",
  ]
    .filter((value): value is string | number => value !== null && value !== "")
    .join(" ")
    .slice(0, 300);
}

type FxRate = {
  numerator: bigint;
  denominator: bigint;
  source: string;
  observedAt: string;
};
let cachedFx: { expiresAt: number; rate: FxRate } | null = null;

async function usdToMxn(fetchImpl: typeof fetch): Promise<FxRate | null> {
  if (cachedFx && cachedFx.expiresAt > Date.now()) return cachedFx.rate;
  const configured = process.env.USD_MXN_RATE?.trim();
  let rate: number | null = configured ? Number(configured) : null;
  let source = "configured";
  if (!rate || !Number.isFinite(rate) || rate <= 0) {
    try {
      const response = await fetchImpl(
        "https://api.frankfurter.app/latest?from=USD&to=MXN",
        {
          signal: AbortSignal.timeout(3_000),
          headers: { Accept: "application/json" },
        },
      );
      if (response.ok) {
        const payload = (await response.json()) as { rates?: { MXN?: number } };
        rate =
          typeof payload.rates?.MXN === "number" ? payload.rates.MXN : null;
        source = "frankfurter";
      }
    } catch {
      rate = null;
    }
  }
  if (!rate) return null;
  const [whole, fraction = ""] = String(rate).split(".");
  const denominator = BigInt(10 ** Math.min(6, fraction.length));
  const numerator =
    BigInt(whole) * denominator +
    BigInt(fraction.padEnd(Number(Math.log10(Number(denominator))), "0"));
  const result = {
    numerator,
    denominator,
    source,
    observedAt: new Date().toISOString(),
  };
  cachedFx = { rate: result, expiresAt: Date.now() + 86_400_000 };
  return result;
}

function toComparable(
  item: z.infer<typeof shoppingItemSchema>,
  market: "MX" | "US",
  fx: FxRate | null,
): RawMarketComparable | null {
  if (item.installment && !item.extracted_price) return null;
  const rawPrice = item.extracted_price ?? item.price?.replace(/[^0-9.,]/g, "");
  if (rawPrice === undefined) return null;
  const originalMinor = parseDecimalToMinorUnits(String(rawPrice));
  if (originalMinor === null) return null;
  const priceMxn =
    market === "MX"
      ? originalMinor
      : fx
        ? Number(
            ceilDivide(BigInt(originalMinor) * fx.numerator, fx.denominator),
          )
        : null;
  if (priceMxn === null || !Number.isSafeInteger(priceMxn)) return null;
  return {
    merchant: item.source?.trim() || "Comercio no identificado",
    productName: item.title,
    priceMxn,
    originalPriceMinor: originalMinor,
    originalCurrency: market === "US" ? "USD" : "MXN",
    originalPrice: String(rawPrice),
    url: safeSourceUrl(item.link ?? item.product_link),
    identifier: item.product_id === undefined ? null : String(item.product_id),
    availability: availabilityFrom(item),
    condition: conditionFrom(item),
    marketScope: marketScopeFrom(item),
    normalizationSource: market === "US" ? fx?.source : "native_mxn",
    normalizationObservedAt:
      market === "US" ? fx?.observedAt : new Date().toISOString(),
  };
}

export class SerpApiMarketPriceProvider implements MarketPriceProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {
    if (!apiKey.trim()) throw new Error("SERPAPI_API_KEY no está configurada.");
  }

  async getMarketPrice(
    input: MarketPriceInput,
    options?: { forceRefresh?: boolean; query?: string; market?: "MX" | "US" },
  ): Promise<MarketPriceResult> {
    const searchQuery = options?.query ?? buildMarketSearchQuery(input);
    const market = options?.market ?? "MX";
    const url = new URL(SERPAPI_ENDPOINT);
    url.search = new URLSearchParams({
      engine: "google_shopping",
      q: searchQuery,
      gl: market === "US" ? "us" : "mx",
      hl: "es",
      location: market === "US" ? "United States" : "Mexico City, Mexico",
      device: "desktop",
      api_key: this.apiKey,
      ...(options?.forceRefresh ? { no_cache: "true" } : {}),
    }).toString();
    const response = await this.fetchImpl(url, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: { Accept: "application/json" },
    });
    if (!response.ok)
      throw new Error(`SerpApi respondió HTTP ${response.status}.`);
    const parsed = responseSchema.parse(await response.json());
    if (parsed.error) throw new Error("SerpApi no pudo completar la consulta.");
    const items = [
      ...(parsed.shopping_results ?? []),
      ...(parsed.inline_shopping_results ?? []),
    ];
    const fx = market === "US" ? await usdToMxn(this.fetchImpl) : null;
    const comparables = items
      .map((item) => toComparable(item, market, fx))
      .filter((value): value is RawMarketComparable => value !== null);
    return buildMarketPriceResult({
      product: input,
      comparables,
      provider: "serpapi",
      searchQuery,
      checkedAt: new Date().toISOString(),
    });
  }
}
