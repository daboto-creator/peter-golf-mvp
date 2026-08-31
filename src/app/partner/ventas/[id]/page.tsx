import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";

import {
  FulfillmentActionForm,
  ShipmentConfirmationForm,
} from "@/components/marketplace/fulfillment-action-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneyMinorUnits } from "@/lib/catalog/presentation";
import {
  confirmPartnerShipmentAction,
  transitionPartnerFulfillmentAction,
} from "@/lib/marketplace/fulfillment-actions";
import { fulfillmentStatusLabel } from "@/lib/marketplace/presentation";
import { getPartnerSale } from "@/lib/marketplace/fulfillment-data";
import { ClaimWorkflowForm } from "@/components/marketplace/claim-action-form";
import { partnerClaimResponseAction } from "@/lib/marketplace/claim-actions";
import { getPartnerClaims } from "@/lib/marketplace/claim-data";
import { claimReasonLabel } from "@/lib/marketplace/claim-rules";

export default async function PartnerSaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getPartnerSale(id);
  const sale = result.data[0];
  if (!sale) notFound();
  const claims = await getPartnerClaims();
  const claim = claims.data.find(
    (item) => item.fulfillment_id === sale.fulfillment_id,
  );
  return (
    <div className="space-y-8">
      <header>
        <p className="text-pg-gold text-xs font-semibold uppercase">
          {sale.order_number}
        </p>
        <h1 className="mt-3 text-4xl font-semibold">{sale.listing_title}</h1>
        <p className="text-muted-foreground mt-3">
          Estado: {fulfillmentStatusLabel[sale.status]}
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Tu envío</CardTitle>
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
      {claim ? (
        <Card>
          <CardHeader>
            <CardTitle>Reclamo en revisión</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>{claimReasonLabel(claim.reason)}</p>
            <p className="text-muted-foreground text-sm">
              Estado: En revisión. Best Round protege los datos del comprador y
              toma la decisión final.
            </p>
            {claim.status !== "RESOLVED" && claim.status !== "CANCELLED" ? (
              <ClaimWorkflowForm
                action={partnerClaimResponseAction}
                claimId={claim.id}
                idempotencyKey={randomUUID()}
                mode="partner-response"
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}
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
        {sale.status === "READY_FOR_CARRIER" ? (
          <ShipmentConfirmationForm
            action={confirmPartnerShipmentAction}
            fulfillmentId={sale.fulfillment_id}
            version={sale.version}
            idempotencyKey={randomUUID()}
          />
        ) : null}
      </div>
      {sale.status === "SHIPPED" ? (
        <Card>
          <CardHeader>
            <CardTitle>Envío confirmado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <strong>Transportista:</strong> {sale.carrier}
            </p>
            <p>
              <strong>Tracking:</strong> {sale.tracking_number}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
