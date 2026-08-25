import { randomUUID } from "node:crypto";

import Link from "next/link";
import { notFound } from "next/navigation";

import {
  MarketplacePricingQuoteForm,
  PricingWorkflowForm,
  RequestMarketplaceAnalysisForm,
} from "@/components/marketplace/pricing-forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMarketplacePartner } from "@/lib/auth/marketplace-authorization";
import { formatMoneyMinorUnits } from "@/lib/catalog/presentation";
import { getMarketplacePricingDetail } from "@/lib/marketplace/pricing-data";

const quoteStatusCopy = {
  DRAFT: "Borrador",
  ANALYZED: "Analizada",
  PARTNER_ACCEPTED: "Aceptada por ti",
  UNDER_REVIEW: "En revisión Best Round",
  CHANGES_REQUESTED: "Requiere ajuste",
  APPROVED: "Pricing aprobado",
  REJECTED: "No aprobado",
  SUPERSEDED: "Reemplazada",
  EXPIRED: "Vencida",
} as const;

function MoneyRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-5 border-b py-3 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <strong>{formatMoneyMinorUnits(value)}</strong>
    </div>
  );
}

export default async function PartnerMarketplacePricingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { partner } = await requireMarketplacePartner(
    `/partner/publicaciones/${id}/precio`,
  );
  const detail = await getMarketplacePricingDetail(id);
  if (
    !detail.listing ||
    detail.error ||
    detail.listing.partner_id !== partner.id
  )
    notFound();
  const version = detail.listing.marketplace_listing_versions;
  if (!version) notFound();
  const latestAnalysis = detail.analyses.find((analysis) =>
    ["COMPLETE", "INSUFFICIENT_DATA", "PROVIDER_UNAVAILABLE"].includes(
      analysis.status,
    ),
  );
  const latestQuote = detail.quotes[0];
  const canPrice = detail.listing.status === "APPROVED";
  const analysisStale = latestAnalysis?.isStale ?? false;
  return (
    <div className="space-y-8">
      <header>
        <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
          Pricing Marketplace · Versión aprobada {version.version_number}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em]">
          {version.title ?? "Precio de publicación"}
        </h1>
        <p className="text-muted-foreground mt-3 max-w-3xl">
          Market Intelligence recomienda. El motor determinístico calcula cada
          cargo. Best Round toma la decisión final antes de una futura
          publicación.
        </p>
      </header>

      {!canPrice ? (
        <Card>
          <CardHeader>
            <CardTitle>Primero necesitamos aprobar el producto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              El pricing se liga exclusivamente a una versión aprobada para
              evitar usar economía de especificaciones distintas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Referencia Best Round</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {latestAnalysis ? (
                  <>
                    <p className="text-sm">
                      <strong>{latestAnalysis.confidence}</strong> ·{" "}
                      {latestAnalysis.valid_comparable_count} referencias
                      válidas
                    </p>
                    {analysisStale ? (
                      <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
                        STALE · Actualiza la referencia antes de generar una
                        nueva quote.
                      </p>
                    ) : null}
                    {latestAnalysis.recommended_price ? (
                      <>
                        <MoneyRow
                          label="Rango bajo"
                          value={
                            latestAnalysis.low_market ??
                            latestAnalysis.recommended_price
                          }
                        />
                        <MoneyRow
                          label="Precio recomendado"
                          value={latestAnalysis.recommended_price}
                        />
                        <MoneyRow
                          label="Rango alto"
                          value={
                            latestAnalysis.high_market ??
                            latestAnalysis.recommended_price
                          }
                        />
                      </>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        Referencia temporalmente no disponible. Puedes calcular
                        cargos y solicitar revisión manual.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Aún no hay una referencia oficial para esta versión.
                  </p>
                )}
                <RequestMarketplaceAnalysisForm
                  listingId={id}
                  listingVersionId={version.id}
                  idempotencyKey={randomUUID()}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Nueva propuesta</CardTitle>
              </CardHeader>
              <CardContent>
                <MarketplacePricingQuoteForm
                  listingId={id}
                  listingVersionId={version.id}
                  analysisId={
                    analysisStale ? null : (latestAnalysis?.id ?? null)
                  }
                  idempotencyKey={randomUUID()}
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {latestQuote ? (
              <Card>
                <CardHeader>
                  <CardTitle>
                    Propuesta #{latestQuote.quote_version} ·{" "}
                    {quoteStatusCopy[latestQuote.status]}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="rounded-2xl bg-black p-5 text-white">
                    <p className="text-xs tracking-[0.14em] text-white/60 uppercase">
                      Recibirías aproximadamente
                    </p>
                    <p className="mt-2 text-3xl font-semibold">
                      {formatMoneyMinorUnits(latestQuote.estimated_partner_net)}
                    </p>
                    <p className="mt-2 text-sm text-white/70">
                      Nivel{" "}
                      {latestQuote.effective_partner_tier.replaceAll("_", " ")}{" "}
                      · comisión {latestQuote.commission_rate_bps / 100}%
                    </p>
                  </div>
                  <MoneyRow
                    label="Precio al cliente"
                    value={latestQuote.calculated_public_price}
                  />
                  {latestQuote.desired_public_price ? (
                    <MoneyRow
                      label="Precio público que propusiste"
                      value={latestQuote.desired_public_price}
                    />
                  ) : null}
                  {latestQuote.desired_partner_net ? (
                    <MoneyRow
                      label="Neto que esperabas"
                      value={latestQuote.desired_partner_net}
                    />
                  ) : null}
                  {latestQuote.desired_public_price &&
                  latestQuote.desired_partner_net &&
                  (latestQuote.calculated_public_price !==
                    latestQuote.desired_public_price ||
                    latestQuote.estimated_partner_net !==
                      latestQuote.desired_partner_net) ? (
                    <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
                      Tus objetivos de precio y neto no coinciden exactamente.
                      Conservamos ambos y usamos la prioridad que seleccionaste.
                    </p>
                  ) : null}
                  <MoneyRow
                    label="Comisión Best Round"
                    value={latestQuote.commission_amount}
                  />
                  <MoneyRow
                    label="IVA sobre comisión"
                    value={latestQuote.commission_vat}
                  />
                  <MoneyRow
                    label="Procesamiento estimado total"
                    value={latestQuote.processing_total}
                  />
                  <MoneyRow
                    label="Parte del Partner"
                    value={latestQuote.partner_processing_share}
                  />
                  <MoneyRow
                    label="Fee administrativo porcentual"
                    value={latestQuote.admin_percentage_fee}
                  />
                  <MoneyRow
                    label="Fee administrativo fijo"
                    value={latestQuote.admin_fixed_fee_amount}
                  />
                  <div className="rounded-xl border p-4 text-sm">
                    <strong>
                      Viabilidad: {latestQuote.viability.replaceAll("_", " ")}
                    </strong>
                    {latestQuote.market_reference ? (
                      <p className="text-muted-foreground mt-1">
                        Referencia central{" "}
                        {formatMoneyMinorUnits(latestQuote.market_reference)}.
                        El precio nunca se ajusta sin tu decisión.
                      </p>
                    ) : null}
                  </div>
                  {["DRAFT", "ANALYZED", "CHANGES_REQUESTED"].includes(
                    latestQuote.status,
                  ) ? (
                    <PricingWorkflowForm
                      quoteId={latestQuote.id}
                      listingId={id}
                      lockVersion={latestQuote.lock_version}
                      status="PARTNER_ACCEPTED"
                      label="Aceptar esta propuesta"
                    />
                  ) : latestQuote.status === "PARTNER_ACCEPTED" ? (
                    <PricingWorkflowForm
                      quoteId={latestQuote.id}
                      listingId={id}
                      lockVersion={latestQuote.lock_version}
                      status="UNDER_REVIEW"
                      label="Solicitar revisión Best Round"
                    />
                  ) : null}
                  {latestQuote.status === "APPROVED" ? (
                    <p className="border-pg-gold/40 rounded-xl border p-4 text-sm">
                      Pricing aprobado. Esto todavía no hace pública ni
                      comprable la publicación.
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-muted-foreground pt-6 text-sm">
                  Crea una propuesta para ver el breakdown completo.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
      <Button asChild variant="outline">
        <Link href={`/partner/publicaciones/${id}`}>
          Volver a la publicación
        </Link>
      </Button>
    </div>
  );
}
