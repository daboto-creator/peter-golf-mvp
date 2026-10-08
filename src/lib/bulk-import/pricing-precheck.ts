import type { BulkImportType, NormalizedBulkRow, PricingPrecheck } from "./types";
import { resolveMarketplacePrice } from "@/lib/pricing/marketplace-pricing-engine";
import type { MarketplaceEconomicsConfig } from "@/lib/pricing/marketplace-pricing-types";

export type ResearchCache = ReadonlyMap<string, { marketReferenceMinor: number | null }>;

export function pricingResearchKey(row: NormalizedBulkRow): string | null {
  if (!row.normalized.brand || !row.normalized.model || !row.normalized.category) return null;
  return [row.normalized.brand, row.normalized.category, row.normalized.model, row.normalized.modelYear ?? "", row.normalized.condition ?? ""].join("|").toLocaleLowerCase("es-MX");
}

export function dedupePricingRequests(rows: NormalizedBulkRow[]): string[] {
  return [...new Set(rows.map(pricingResearchKey).filter((value): value is string => Boolean(value)))];
}

export function runPricingPrecheck(input: { importType: BulkImportType; row: NormalizedBulkRow; research?: ResearchCache; marketplaceConfig?: MarketplaceEconomicsConfig }): PricingPrecheck {
  const key = pricingResearchKey(input.row);
  const marketReferenceMinor = key ? input.research?.get(key)?.marketReferenceMinor ?? null : null;
  const proposed = input.importType === "PARTNER" ? input.row.normalized.askingPriceMinor : input.row.normalized.askingPriceMinor;
  const resolution = input.importType === "PARTNER" && input.marketplaceConfig && (proposed !== null || input.row.normalized.desiredNetMinor !== null)
    ? resolveMarketplacePrice({ inputMode: input.row.normalized.desiredNetMinor !== null ? "NET_PRIORITY" : "PUBLIC_PRICE_PRIORITY", desiredPublicPriceMinor: proposed, desiredPartnerNetMinor: input.row.normalized.desiredNetMinor, config: input.marketplaceConfig })
    : null;
  return {
    status: marketReferenceMinor === null ? "INSUFFICIENT_DATA" : proposed === null ? "INSUFFICIENT_DATA" : proposed > marketReferenceMinor * 1.15 ? "OVERPRICED" : proposed < marketReferenceMinor * 0.85 ? "UNDERPRICED" : "COMPETITIVE",
    proposedPriceMinor: proposed,
    marketReferenceMinor,
    estimatedPartnerNetMinor: resolution?.economics.partnerNetMinor ?? (input.importType === "PARTNER" ? input.row.normalized.desiredNetMinor : null),
    viability: marketReferenceMinor === null ? "Requiere revisión de precio" : "Precheck listo",
    researchRequestKey: key,
    reusedResearch: marketReferenceMinor !== null,
  };
}
