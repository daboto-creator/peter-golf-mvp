import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";

import { FulfillmentActionForm } from "@/components/marketplace/fulfillment-action-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneyMinorUnits } from "@/lib/catalog/presentation";
import { transitionPartnerFulfillmentAction } from "@/lib/marketplace/fulfillment-actions";
import { getPartnerSale } from "@/lib/marketplace/fulfillment-data";

export default async function PartnerSaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getPartnerSale(id);
  const sale = result.data[0];
  if (!sale) notFound();
  return (
    <div className="space-y-8">
      <header>
        <p className="text-pg-gold text-xs font-semibold uppercase">
          {sale.order_number}
        </p>
        <h1 className="mt-3 text-4xl font-semibold">{sale.listing_title}</h1>
        <p className="text-muted-foreground mt-3">Estado: {sale.status}</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Tu fulfillment</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <p>Cantidad: {sale.quantity}</p>
          <p>
            Neto estimado:{" "}
            {formatMoneyMinorUnits(Number(sale.estimated_partner_net))}
          </p>
          <p className="text-muted-foreground sm:col-span-2">
            Best Round protege los datos de pago y la identidad de otros
            sellers. Aquí sólo aparece lo necesario para preparar tu parte.
          </p>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {sale.status === "PENDING_CONFIRMATION" ? (
          <>
            <FulfillmentActionForm
              action={transitionPartnerFulfillmentAction}
              fulfillmentId={sale.fulfillment_id}
              version={sale.version}
              idempotencyKey={randomUUID()}
              operation="CONFIRM_AVAILABILITY"
              label="Confirmar existencia"
            />
            <FulfillmentActionForm
              action={transitionPartnerFulfillmentAction}
              fulfillmentId={sale.fulfillment_id}
              version={sale.version}
              idempotencyKey={randomUUID()}
              operation="UNAVAILABLE"
              label="No tengo disponibilidad"
              requireReason
            />
          </>
        ) : null}
        {sale.status === "CONFIRMED" ? (
          <FulfillmentActionForm
            action={transitionPartnerFulfillmentAction}
            fulfillmentId={sale.fulfillment_id}
            version={sale.version}
            idempotencyKey={randomUUID()}
            operation="START_PREPARING"
            label="Preparar envío"
          />
        ) : null}
        {sale.status === "PREPARING" ? (
          <FulfillmentActionForm
            action={transitionPartnerFulfillmentAction}
            fulfillmentId={sale.fulfillment_id}
            version={sale.version}
            idempotencyKey={randomUUID()}
            operation="READY_FOR_CARRIER"
            label="Marcar listo"
          />
        ) : null}
      </div>
    </div>
  );
}
