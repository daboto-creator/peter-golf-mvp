import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";

import { FulfillmentActionForm } from "@/components/marketplace/fulfillment-action-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMarketplaceOrdersManager } from "@/lib/auth/marketplace-authorization";
import { formatMoneyMinorUnits } from "@/lib/catalog/presentation";
import { transitionOperationsFulfillmentAction } from "@/lib/marketplace/fulfillment-actions";
import { getMarketplaceOrderForOperations } from "@/lib/marketplace/fulfillment-data";

export default async function MarketplaceOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireMarketplaceOrdersManager(`/operacion/marketplace/ordenes/${id}`);
  const detail = await getMarketplaceOrderForOperations(id);
  if (!detail.order) notFound();
  return (
    <div className="space-y-8">
      <header>
        <p className="text-pg-gold text-xs font-semibold uppercase">
          Marketplace · {detail.order.order_number}
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Control de fulfillment</h1>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Orden Best Round</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <p>Estado: {detail.order.status}</p>
          <p>Excepción: {detail.order.marketplace_exception_status}</p>
          <p>Total: {formatMoneyMinorUnits(Number(detail.order.total))}</p>
        </CardContent>
      </Card>
      {detail.fulfillments.map((fulfillment) => (
        <Card key={fulfillment.id}>
          <CardHeader>
            <CardTitle>
              {fulfillment.source} · {fulfillment.status}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Modo {fulfillment.fulfillment_mode ?? "BEST_ROUND_FULFILLED"} ·
              SLA inventario{" "}
              {fulfillment.inventory_confirmation_due_at
                ? new Intl.DateTimeFormat("es-MX", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(fulfillment.inventory_confirmation_due_at))
                : "se activa después del pago"}
            </p>
            {fulfillment.source === "PARTNER" ? (
              <div className="grid gap-3 md:grid-cols-3">
                <FulfillmentActionForm
                  action={transitionOperationsFulfillmentAction}
                  fulfillmentId={fulfillment.id}
                  version={fulfillment.version}
                  idempotencyKey={randomUUID()}
                  operation="HOLD"
                  label="Poner en hold"
                  requireReason
                />
                {fulfillment.status === "ON_HOLD" ? (
                  <FulfillmentActionForm
                    action={transitionOperationsFulfillmentAction}
                    fulfillmentId={fulfillment.id}
                    version={fulfillment.version}
                    idempotencyKey={randomUUID()}
                    operation="RELEASE_HOLD"
                    label="Liberar hold"
                    requireReason
                  />
                ) : null}
                {fulfillment.status === "SHIPPED" ? (
                  <FulfillmentActionForm
                    action={transitionOperationsFulfillmentAction}
                    fulfillmentId={fulfillment.id}
                    version={fulfillment.version}
                    idempotencyKey={randomUUID()}
                    operation="RECORD_DELIVERY"
                    label="Confirmar entrega"
                    requireReason
                  />
                ) : null}
                <FulfillmentActionForm
                  action={transitionOperationsFulfillmentAction}
                  fulfillmentId={fulfillment.id}
                  version={fulfillment.version}
                  idempotencyKey={randomUUID()}
                  operation="CANCEL"
                  label="Cancelar fulfillment"
                  requireReason
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
