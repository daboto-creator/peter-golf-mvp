import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMarketplaceOrdersManager } from "@/lib/auth/marketplace-authorization";
import { listMarketplaceOrdersForOperations } from "@/lib/marketplace/fulfillment-data";

export default async function MarketplaceOrdersPage() {
  await requireMarketplaceOrdersManager("/operacion/marketplace/ordenes");
  const result = await listMarketplaceOrdersForOperations();
  return (
    <div className="space-y-8">
      <header>
        <p className="text-pg-gold text-xs font-semibold uppercase">
          Marketplace · Operaciones
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Órdenes y fulfillments</h1>
        <p className="text-muted-foreground mt-3">
          Una orden Best Round, con seguimiento separado por fuente y Partner.
        </p>
      </header>
      {result.error ? (
        <p role="alert" className="text-destructive">
          No pudimos cargar la cola.
        </p>
      ) : null}
      <div className="grid gap-4">
        {result.data.map((fulfillment) => (
          <Link
            key={fulfillment.id}
            href={`/operacion/marketplace/ordenes/${fulfillment.order_id}`}
          >
            <Card className="transition hover:border-black">
              <CardHeader>
                <CardTitle>
                  {fulfillment.orders?.order_number ?? "Orden"}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm sm:grid-cols-3">
                <p>{fulfillment.source}</p>
                <p>{fulfillment.status}</p>
                <p>{fulfillment.fulfillment_mode ?? "Best Round"}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
