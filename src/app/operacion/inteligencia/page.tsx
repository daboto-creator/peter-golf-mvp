import { requireMarketplacePricingManager } from "@/lib/auth/marketplace-authorization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
          "Aceptación de recomendaciones",
          "Mediana sugerido vs vendido",
          "Resuelto sin investigación externa",
          "Cache hit",
          "Fallback USA",
          "Mediana días a venta",
        ].map((label) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle className="text-sm">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">—</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Se calcula con snapshots de resultados válidos.
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
          Los índices de reventa y consistencia de fuentes son internos,
          conservadores y no modifican las reglas financieras.
        </CardContent>
      </Card>
    </div>
  );
}
