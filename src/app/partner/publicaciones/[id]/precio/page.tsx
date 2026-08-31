import { randomUUID } from "node:crypto";

import Link from "next/link";
import { notFound } from "next/navigation";

import { ListingWizardHeader } from "@/components/marketplace/listing-wizard";
import { PartnerDesiredPriceForm } from "@/components/marketplace/pricing-forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMarketplacePartner } from "@/lib/auth/marketplace-authorization";
import { formatMoneyMinorUnits } from "@/lib/catalog/presentation";
import { getMarketplacePricingDetail } from "@/lib/marketplace/pricing-data";
import { pricingViabilityLabel } from "@/lib/marketplace/presentation";

function MoneyRow({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center justify-between gap-5 border-b py-3 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <strong>{value === null ? "—" : formatMoneyMinorUnits(value)}</strong>
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
    !detail.version ||
    detail.error ||
    detail.listing.partner_id !== partner.id
  )
    notFound();
  const latestAnalysis = detail.analyses.find((analysis) =>
    ["COMPLETE", "INSUFFICIENT_DATA", "PROVIDER_UNAVAILABLE"].includes(
      analysis.status,
    ),
  );
  const latestQuote = detail.quotes[0];
  const editable = ["DRAFT", "CHANGES_REQUESTED"].includes(
    detail.listing.status,
  );
  const processingFee = latestQuote
    ? latestQuote.partner_processing_share +
      latestQuote.admin_percentage_fee +
      latestQuote.admin_fixed_fee_amount
    : null;
  return (
    <div className="space-y-8">
      {editable ? (
        <ListingWizardHeader
          listingId={id}
          current="precio"
          title="Define tu precio"
        />
      ) : (
        <header>
          <p className="text-pg-gold text-xs font-semibold uppercase">
            Precio y mercado
          </p>
          <h1 className="mt-3 text-4xl font-semibold">
            {detail.version.title ?? "Precio de publicación"}
          </h1>
        </header>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Best Round Intelligence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {latestAnalysis?.recommended_price ? (
              <>
                <MoneyRow
                  label="Precio recomendado por Best Round"
                  value={latestAnalysis.recommended_price}
                />
                <MoneyRow
                  label="Rango observado · bajo"
                  value={latestAnalysis.low_market}
                />
                <MoneyRow
                  label="Rango observado · alto"
                  value={latestAnalysis.high_market}
                />
                <p className="text-muted-foreground text-sm">
                  {latestAnalysis.valid_comparable_count} referencias válidas ·
                  confianza {latestAnalysis.confidence.toLowerCase()}.
                </p>
              </>
            ) : (
              <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
                Falta analizar precio de mercado. Puedes enviar tu publicación
                si el cálculo financiero determinístico es viable; el análisis
                continuará antes de la revisión de Operations.
              </p>
            )}
            {editable ? (
              <PartnerDesiredPriceForm
                listingId={id}
                lockVersion={detail.listing.lock_version}
                analysisId={
                  latestAnalysis && !latestAnalysis.isStale
                    ? latestAnalysis.id
                    : null
                }
                idempotencyKey={randomUUID()}
              />
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tu resultado</CardTitle>
          </CardHeader>
          <CardContent>
            {latestQuote ? (
              <>
                <MoneyRow
                  label="Tu precio de venta"
                  value={latestQuote.calculated_public_price}
                />
                <MoneyRow
                  label="Comisión Best Round"
                  value={latestQuote.commission_amount}
                />
                <MoneyRow
                  label="IVA de comisión"
                  value={latestQuote.commission_vat}
                />
                <MoneyRow label="Fee procesamiento" value={processingFee} />
                <div className="mt-4 rounded-2xl bg-black p-5 text-white">
                  <p className="text-xs tracking-wide text-white/60 uppercase">
                    Recibirías aproximadamente
                  </p>
                  <p className="mt-2 text-3xl font-semibold">
                    {formatMoneyMinorUnits(latestQuote.estimated_partner_net)}
                  </p>
                </div>
                <p className="text-muted-foreground mt-4 text-sm">
                  {pricingViabilityLabel[latestQuote.viability] ??
                    latestQuote.viability}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                Indica tu precio para ver el resultado completo.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-wrap gap-3">
        {editable && latestQuote ? (
          <Button asChild>
            <Link href={`/partner/publicaciones/${id}/revision`}>
              Continuar a revisión final
            </Link>
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <Link href={`/partner/publicaciones/${id}`}>Volver</Link>
        </Button>
      </div>
    </div>
  );
}
