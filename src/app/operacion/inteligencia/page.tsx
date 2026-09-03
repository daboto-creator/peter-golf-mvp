import { requireMarketplacePricingManager } from "@/lib/auth/marketplace-authorization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  calculateIntelligenceMetrics,
  calculateResaleSignal,
  type IntelligenceOutcome,
} from "@/lib/pricing/intelligence-learning";

export default async function IntelligenceDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; category?: string }>;
}) {
  await requireMarketplacePricingManager("/operacion/inteligencia");
  const search = await searchParams;
  const range =
    search.range === "30" || search.range === "all" ? search.range : "90";
  const category = search.category ?? "all";
  const client = await createClient();
  let query = client
    .from("intelligence_outcome_snapshots" as never)
    .select("*")
    .limit(500);
  if (range !== "all")
    query = query.gte(
      "sold_at",
      // The dashboard's server-side date window is intentionally evaluated per request.
      // eslint-disable-next-line react-hooks/purity
      new Date(Date.now() - Number(range) * 86_400_000).toISOString(),
    );
  if (category !== "all") query = query.eq("category", category);
  const result = await query;
  const rows = (result.data ?? []) as unknown as Array<Record<string, unknown>>;
  const outcomes: IntelligenceOutcome[] = rows.map((row) => ({
    id: String(row.outcome_key),
    source: row.source === "MARKETPLACE" ? "MARKETPLACE" : "FIRST_PARTY",
    brand: typeof row.brand === "string" ? row.brand : null,
    canonicalModel:
      typeof row.canonical_model === "string" ? row.canonical_model : null,
    category: typeof row.category === "string" ? row.category : null,
    condition: typeof row.condition === "string" ? row.condition : null,
    acquisitionCostMinor: null,
    recommendedPriceMinor:
      row.recommended_price_minor == null
        ? null
        : Number(row.recommended_price_minor),
    finalSoldPriceMinor: Number(row.final_sold_price_minor),
    marketReferenceMinor:
      row.market_reference_minor == null
        ? null
        : Number(row.market_reference_minor),
    recommendationAccepted:
      typeof row.recommendation_accepted === "boolean"
        ? row.recommendation_accepted
        : null,
    listedAt: typeof row.listed_at === "string" ? row.listed_at : null,
    soldAt: String(row.sold_at),
    daysInInventory:
      row.days_in_inventory == null ? null : Number(row.days_in_inventory),
    validEconomicSale: true,
  }));
  const metrics = calculateIntelligenceMetrics({
    outcomes,
    recommendationsPresented: outcomes.filter(
      (row) => row.recommendedPriceMinor !== null,
    ).length,
    acceptedRecommendations: outcomes.filter(
      (row) => row.recommendationAccepted === true,
    ).length,
    analyses: [],
    overrides: 0,
  });
  const resale =
    outcomes[0]?.brand && outcomes[0].canonicalModel
      ? calculateResaleSignal(
          outcomes,
          outcomes[0].brand,
          outcomes[0].canonicalModel,
        )
      : null;
  return (
    <div className="space-y-8">
      <header>
        <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
          Operations · Intelligence
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Best Round Intelligence</h1>
        <p className="text-muted-foreground mt-3">
          Señales estadísticas basadas en ventas económicamente válidas.
        </p>
      </header>
      <div className="flex flex-wrap gap-2 text-sm">
        {(["30", "90", "all"] as const).map((value) => (
          <a
            className={
              range === value
                ? "rounded-full bg-black px-3 py-1 text-white"
                : "rounded-full border px-3 py-1"
            }
            href={`/operacion/inteligencia?range=${value}&category=${encodeURIComponent(category)}`}
            key={value}
          >
            {value === "all" ? "Todo" : `Últimos ${value} días`}
          </a>
        ))}
        <span className="rounded-full border px-3 py-1">
          Categoría: {category === "all" ? "Todas" : category}
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          [
            "Aceptación de recomendaciones",
            metrics.recommendationAcceptanceRateBps,
          ],
          ["Mediana sugerido vs vendido", metrics.medianSuggestedVsSoldBps],
          ["Mediana días a venta", metrics.medianDaysToSale],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardHeader>
              <CardTitle className="text-sm">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">
                {value === null ? "—" : String(value)}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Basado en {outcomes.length} snapshots válidos.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Señales de aprendizaje</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          {resale
            ? `${resale.brand} ${resale.model}: índice ${resale.resaleIndex ?? "—"}, muestra ${resale.sampleSize}, confianza ${resale.confidence}. `
            : "Aún no hay suficientes ventas comparables. "}
          Los índices de reventa y consistencia de fuentes son internos,
          conservadores y no modifican las reglas financieras.
        </CardContent>
      </Card>
    </div>
  );
}
