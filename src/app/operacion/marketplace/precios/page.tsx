import Link from "next/link";

import { CompleteMarketplaceAnalysisForm } from "@/components/marketplace/pricing-forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMarketplacePricingManager } from "@/lib/auth/marketplace-authorization";
import { formatMoneyMinorUnits } from "@/lib/catalog/presentation";
import {
  listMarketplacePricingForOperations,
  listPendingMarketplaceAnalysisRequests,
} from "@/lib/marketplace/pricing-data";
import type { Database } from "@/types/database.types";

type QuoteStatus =
  Database["public"]["Enums"]["marketplace_pricing_quote_status"];

const allowedStatuses = new Set<QuoteStatus>([
  "DRAFT",
  "ANALYZED",
  "PARTNER_ACCEPTED",
  "UNDER_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "REJECTED",
  "SUPERSEDED",
  "EXPIRED",
]);

export default async function MarketplacePricingQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  await requireMarketplacePricingManager("/operacion/marketplace/precios");
  const search = await searchParams;
  const page = Math.max(1, Number(search.page) || 1);
  const status = allowedStatuses.has(search.status as QuoteStatus)
    ? (search.status as QuoteStatus)
    : undefined;
  const [quotes, requests] = await Promise.all([
    listMarketplacePricingForOperations(page, status),
    listPendingMarketplaceAnalysisRequests(),
  ]);
  return (
    <div className="space-y-8">
      <header>
        <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
          Marketplace · Pricing
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Economía y mercado</h1>
        <p className="text-muted-foreground mt-3">
          Provider e inteligencia comercial separados del cálculo financiero
          determinístico.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Investigación solicitada</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.data.length ? (
            <ul className="divide-y">
              {requests.data.map((request) => (
                <li
                  key={request.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <strong>
                      {request.listing_version?.title ?? "Publicación Partner"}
                    </strong>
                    <p className="text-muted-foreground text-xs">
                      {new Intl.DateTimeFormat("es-MX", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(request.requested_at))}
                    </p>
                  </div>
                  <CompleteMarketplaceAnalysisForm analysisId={request.id} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              Sin solicitudes pendientes.
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Quotes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {quotes.data.map((quote) => {
            const partner = quote.partner_profiles;
            const partnerName =
              partner?.commercial_name ||
              [partner?.first_name, partner?.last_name]
                .filter(Boolean)
                .join(" ") ||
              "Partner";
            return (
              <Link
                key={quote.id}
                href={`/operacion/marketplace/precios/${quote.id}`}
                className="grid gap-2 rounded-xl border p-4 transition hover:border-black sm:grid-cols-[1fr_auto]"
              >
                <div>
                  <strong>
                    {quote.listing_version?.title ?? "Publicación"}
                  </strong>
                  <p className="text-muted-foreground text-sm">
                    {partnerName} · {quote.effective_partner_tier} ·{" "}
                    {quote.status}
                  </p>
                </div>
                <div className="sm:text-right">
                  <strong>
                    {formatMoneyMinorUnits(quote.calculated_public_price)}
                  </strong>
                  <p className="text-muted-foreground text-xs">
                    {quote.viability}
                  </p>
                </div>
              </Link>
            );
          })}
          {!quotes.data.length ? (
            <p className="text-muted-foreground text-sm">Sin cotizaciones.</p>
          ) : null}
        </CardContent>
      </Card>
      <div className="flex gap-3">
        {page > 1 ? (
          <Button asChild variant="outline">
            <Link
              href={`?page=${page - 1}${status ? `&status=${status}` : ""}`}
            >
              Anterior
            </Link>
          </Button>
        ) : null}
        {page * quotes.pageSize < quotes.count ? (
          <Button asChild variant="outline">
            <Link
              href={`?page=${page + 1}${status ? `&status=${status}` : ""}`}
            >
              Siguiente
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
