import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneyMinorUnits } from "@/lib/catalog/presentation";
import { listPartnerSales } from "@/lib/marketplace/fulfillment-data";
import { fulfillmentStatusLabel } from "@/lib/marketplace/presentation";

export default async function PartnerSalesPage() {
  const sales = await listPartnerSales();
  return (
    <div className="space-y-8">
      <header>
        <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
          Portal Partner
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Ventas</h1>
        <p className="text-muted-foreground mt-3">
          Confirma inventario y prepara cada envío sin exponer información
          privada del Golfer.
        </p>
      </header>
      {sales.error ? (
        <p role="alert" className="text-destructive">
          No pudimos cargar tus ventas.
        </p>
      ) : null}
      <div className="grid gap-5 md:grid-cols-2">
        {sales.data.map((sale) => (
          <Link
            key={`${sale.fulfillment_id}-${sale.order_item_id}`}
            href={`/partner/ventas/${sale.fulfillment_id}`}
          >
            <Card className="h-full transition hover:border-black">
              <CardHeader>
                <p className="text-pg-gold text-xs font-semibold">
                  {fulfillmentStatusLabel[sale.status]}
                </p>
                <CardTitle>{sale.listing_title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  {sale.order_number} · Cantidad {sale.quantity}
                </p>
                <p className="text-muted-foreground">
                  Neto estimado{" "}
                  {formatMoneyMinorUnits(Number(sale.estimated_partner_net))}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      {!sales.data.length && !sales.error ? (
        <p className="text-muted-foreground rounded-xl border border-dashed bg-white p-8 text-center">
          Aún no tienes ventas activas.
        </p>
      ) : null}
    </div>
  );
}
