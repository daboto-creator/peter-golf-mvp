import { randomUUID } from "node:crypto";

import Link from "next/link";
import { notFound } from "next/navigation";

import {
  ManualMarketplaceReferenceForm,
  PricingWorkflowForm,
  RequestMarketplaceAnalysisForOperationsForm,
} from "@/components/marketplace/pricing-forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMarketplacePricingManager } from "@/lib/auth/marketplace-authorization";
import { formatMoneyMinorUnits } from "@/lib/catalog/presentation";
import { getMarketplacePricingQuoteForOperations } from "@/lib/marketplace/pricing-data";

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <strong>{formatMoneyMinorUnits(value)}</strong>
    </div>
  );
}

export default async function MarketplacePricingOperationsDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireMarketplacePricingManager(
    `/operacion/marketplace/precios/${id}`,
  );
  const detail = await getMarketplacePricingQuoteForOperations(id);
  if (!detail.quote || detail.error) notFound();
  const quote = detail.quote;
  const version = quote.listing_version;
  const partner = quote.partner_profiles;
  const partnerName =
    partner?.commercial_name ||
    [partner?.first_name, partner?.last_name].filter(Boolean).join(" ") ||
    "Partner";
  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
            Pricing humano · Quote {quote.quote_version}
          </p>
          <h1 className="mt-3 text-4xl font-semibold">
            {version?.title ?? "Pricing Partner"}
          </h1>
          <p className="text-muted-foreground mt-3">
            {partnerName} · {quote.status} · versión listing{" "}
            {version?.version_number}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/operacion/marketplace/precios">Volver a precios</Link>
        </Button>
      </header>
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Snapshot financiero determinístico</CardTitle>
            </CardHeader>
            <CardContent>
              <Row
                label="Precio público"
                value={quote.calculated_public_price}
              />
              <Row label="Comisión" value={quote.commission_amount} />
              <Row label="IVA pass-through" value={quote.commission_vat} />
              <Row label="Procesamiento total" value={quote.processing_total} />
              <Row
                label="Procesamiento Partner"
                value={quote.partner_processing_share}
              />
              <Row
                label="Procesamiento Best Round"
                value={quote.best_round_processing_share}
              />
              <Row
                label="Admin porcentual"
                value={quote.admin_percentage_fee}
              />
              <Row label="Admin fijo" value={quote.admin_fixed_fee_amount} />
              <Row label="Neto Partner" value={quote.estimated_partner_net} />
              <Row
                label="Revenue Best Round estimado"
                value={quote.estimated_best_round_revenue}
              />
              <p className="text-muted-foreground mt-4 text-xs">
                Config {quote.config_version_id} · tier{" "}
                {quote.effective_partner_tier} ({quote.tier_source}) · cálculo{" "}
                {quote.calculation_version}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Market Intelligence</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                <strong>{quote.viability}</strong>
                {quote.market_reference
                  ? ` · referencia ${formatMoneyMinorUnits(quote.market_reference)}`
                  : " · sin datos suficientes"}
              </p>
              {detail.comparables.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2">Comparable</th>
                        <th>Seller</th>
                        <th>Precio</th>
                        <th>Match</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.comparables.map((item) => (
                        <tr key={item.id} className="border-b">
                          <td className="py-3">{item.title}</td>
                          <td>{item.seller}</td>
                          <td>{formatMoneyMinorUnits(item.price)}</td>
                          <td>{item.match_score}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Sin comparables persistidos. Usa referencia manual cuando
                  exista evidencia válida.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Referencia manual auditada</CardTitle>
            </CardHeader>
            <CardContent>
              <ManualMarketplaceReferenceForm
                listingId={quote.listing_id}
                listingVersionId={quote.listing_version_id}
                idempotencyKey={randomUUID()}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Actualizar investigación</CardTitle>
            </CardHeader>
            <CardContent>
              <RequestMarketplaceAnalysisForOperationsForm
                listingId={quote.listing_id}
                listingVersionId={quote.listing_version_id}
                idempotencyKey={randomUUID()}
              />
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Decisión Best Round</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {quote.status === "UNDER_REVIEW" ? (
                <>
                  <PricingWorkflowForm
                    quoteId={quote.id}
                    listingId={quote.listing_id}
                    lockVersion={quote.lock_version}
                    status="APPROVED"
                    label="Aprobar pricing"
                    requireReason
                  />
                  <PricingWorkflowForm
                    quoteId={quote.id}
                    listingId={quote.listing_id}
                    lockVersion={quote.lock_version}
                    status="CHANGES_REQUESTED"
                    label="Solicitar ajuste"
                    requireReason
                  />
                  <PricingWorkflowForm
                    quoteId={quote.id}
                    listingId={quote.listing_id}
                    lockVersion={quote.lock_version}
                    status="REJECTED"
                    label="Rechazar"
                    requireReason
                  />
                </>
              ) : (
                <p className="text-muted-foreground text-sm">
                  La decisión está disponible cuando el Partner envía la quote a
                  revisión.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Historial inmutable</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {detail.history.map((entry) => (
                  <li key={entry.id} className="border-l-2 pl-3 text-sm">
                    <strong>{entry.to_status}</strong>
                    <p className="text-muted-foreground">
                      {new Intl.DateTimeFormat("es-MX", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(entry.created_at))}
                    </p>
                    {entry.reason ? <p>{entry.reason}</p> : null}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
