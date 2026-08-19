import "server-only";

import { z } from "zod";

import type {
  MarketPriceInput,
  MarketPriceProvider,
  MarketPriceResult,
} from "@/lib/pricing/market-price-provider";
import type { RawMarketComparable } from "@/lib/pricing/market-price-matching";
import { buildMarketPriceResult } from "@/lib/pricing/market-price-statistics";

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

function toComparable(
  item: z.infer<typeof shoppingItemSchema>,
): RawMarketComparable | null {
  if (item.installment && !item.extracted_price) return null;
  const rawPrice = item.extracted_price ?? item.price?.replace(/[^0-9.,]/g, "");
  if (rawPrice === undefined) return null;
  const priceMxn = parseDecimalToMinorUnits(String(rawPrice));
  if (priceMxn === null) return null;
  return {
    merchant: item.source?.trim() || "Comercio no identificado",
    productName: item.title,
    priceMxn,
    originalCurrency: "MXN",
    originalPrice: String(rawPrice),
    url: safeSourceUrl(item.link ?? item.product_link),
    identifier: item.product_id === undefined ? null : String(item.product_id),
    availability: availabilityFrom(item),
    condition: conditionFrom(item),
    marketScope: marketScopeFrom(item),
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
    options?: { forceRefresh?: boolean },
  ): Promise<MarketPriceResult> {
    const searchQuery = buildMarketSearchQuery(input);
    const url = new URL(SERPAPI_ENDPOINT);
    url.search = new URLSearchParams({
      engine: "google_shopping",
      q: searchQuery,
      gl: "mx",
      hl: "es",
      location: "Mexico City, Mexico",
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
    const comparables = items
      .map(toComparable)
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
