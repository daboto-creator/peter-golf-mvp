import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";

import { PayoutActionForm } from "@/components/marketplace/payout-action-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMarketplacePayoutsManager } from "@/lib/auth/marketplace-authorization";
import { formatMoneyMinorUnits } from "@/lib/catalog/presentation";
import {
  payoutAction,
  payoutHoldAction,
  recordManualTransferAction,
  releasePayoutHoldAction,
} from "@/lib/marketplace/payout-actions";
import { getPayoutForOperations } from "@/lib/marketplace/payout-data";
import { payoutStatusLabel } from "@/lib/marketplace/payout-rules";

export default async function MarketplacePayoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireMarketplacePayoutsManager(
    `/operacion/marketplace/payouts/${id}`,
  );
  const detail = await getPayoutForOperations(id);
  if (!detail.payout) notFound();
  const payout = detail.payout;
  const activeHolds = detail.holds.filter((hold) => hold.status === "ACTIVE");
  const actionHidden = (
    mode: "ready" | "confirm" | "cancel" | "fail" | "reconcile",
  ) => ({ payoutId: id, mode, idempotencyKey: randomUUID() });
  return (
    <div className="space-y-8">
      <header>
        <p className="text-pg-gold text-xs font-semibold uppercase">
          {payout.payout_reference}
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Payout Partner</h1>
        <p className="text-muted-foreground mt-3">
          {payoutStatusLabel(payout.status)} · {payout.provider}
        </p>
      </header>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Partner: {payout.partner_id}</p>
            <p>{payout.item_count} obligaciones</p>
            <p className="text-xl font-semibold">
              {formatMoneyMinorUnits(Number(payout.total_cents))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Transferencia externa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {detail.settlement ? (
              <>
                <p>{detail.settlement.bank_label}</p>
                <p>Referencia: {detail.settlement.external_reference}</p>
                <p>Fecha: {detail.settlement.transfer_date}</p>
                <p>Settlement: {detail.settlement.status}</p>
              </>
            ) : (
              <p className="text-muted-foreground">Aún no registrada.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Seguridad</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>
              La app sólo registra evidencia de una transferencia realizada
              fuera de Best Round. No existe API bancaria ni Stripe Connect.
            </p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Obligaciones incluidas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {detail.items.map((item) => (
            <div
              key={item.id}
              className="grid gap-2 border-b pb-3 sm:grid-cols-3"
            >
              <p>
                {item.marketplace_partner_payables?.orders?.order_number ??
                  "Orden"}
              </p>
              <p>
                {item.marketplace_partner_payables
                  ?.marketplace_order_item_snapshots?.listing_title ??
                  item.payable_id}
              </p>
              <p className="sm:text-right">
                {formatMoneyMinorUnits(Number(item.settlement_amount_cents))}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
      <section className="grid gap-4 xl:grid-cols-3">
        {payout.status === "DRAFT" ? (
          <PayoutActionForm
            action={payoutAction}
            label="Marcar listo"
            hidden={actionHidden("ready")}
            fields={[
              {
                name: "reason",
                label: "Motivo",
                type: "textarea",
                required: true,
                defaultValue:
                  "Payout revisado y listo para transferencia externa.",
              },
            ]}
          />
        ) : null}
        {payout.status === "READY" && !activeHolds.length ? (
          <PayoutActionForm
            action={recordManualTransferAction}
            label="Registrar transferencia externa"
            hidden={{ payoutId: id, idempotencyKey: randomUUID() }}
            fields={[
              { name: "bankLabel", label: "Banco / proveedor", required: true },
              {
                name: "externalReference",
                label: "Referencia externa",
                required: true,
              },
              {
                name: "transferDate",
                label: "Fecha de transferencia",
                type: "date",
                required: true,
                defaultValue: new Date().toISOString().slice(0, 10),
              },
              {
                name: "confirmedAmountCents",
                label: "Confirmar monto exacto (centavos)",
                type: "number",
                required: true,
                defaultValue: Number(payout.total_cents),
              },
              { name: "note", label: "Nota interna", type: "textarea" },
            ]}
          />
        ) : null}
        {payout.status === "AWAITING_CONFIRMATION" ? (
          <PayoutActionForm
            action={payoutAction}
            label="Confirmar pago"
            hidden={actionHidden("confirm")}
          />
        ) : null}
        {!(["PAID", "FAILED", "CANCELLED"] as string[]).includes(
          payout.status,
        ) ? (
          <PayoutActionForm
            action={payoutHoldAction}
            label="Poner en revisión"
            hidden={{
              payoutId: id,
              source: "OPERATIONS",
              partnerVisible: "false",
              idempotencyKey: randomUUID(),
            }}
            fields={[
              {
                name: "reason",
                label: "Motivo",
                type: "textarea",
                required: true,
              },
            ]}
          />
        ) : null}
        {(["DRAFT", "READY", "ON_HOLD"] as string[]).includes(payout.status) ? (
          <PayoutActionForm
            action={payoutAction}
            label="Cancelar payout"
            destructive
            hidden={actionHidden("cancel")}
            fields={[
              {
                name: "reason",
                label: "Motivo",
                type: "textarea",
                required: true,
              },
            ]}
          />
        ) : null}
        {(["READY", "AWAITING_CONFIRMATION"] as string[]).includes(
          payout.status,
        ) ? (
          <PayoutActionForm
            action={payoutAction}
            label="Marcar fallido"
            destructive
            hidden={actionHidden("fail")}
            fields={[
              {
                name: "reason",
                label: "Motivo",
                type: "textarea",
                required: true,
              },
            ]}
          />
        ) : null}
        {!(["PAID", "CANCELLED"] as string[]).includes(payout.status) ? (
          <PayoutActionForm
            action={payoutAction}
            label="Requiere reconciliación"
            hidden={actionHidden("reconcile")}
            fields={[
              {
                name: "reason",
                label: "Motivo",
                type: "textarea",
                required: true,
              },
            ]}
          />
        ) : null}
      </section>
      {activeHolds.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Holds activos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            {activeHolds.map((hold) => (
              <PayoutActionForm
                key={hold.id}
                action={releasePayoutHoldAction}
                label={`Liberar ${hold.source}`}
                hidden={{
                  payoutId: id,
                  holdId: hold.id,
                  idempotencyKey: randomUUID(),
                }}
                fields={[
                  {
                    name: "reason",
                    label: "Motivo",
                    type: "textarea",
                    required: true,
                  },
                ]}
              />
            ))}
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Historial auditable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {detail.events.map((event) => (
            <div key={event.id} className="border-b pb-3">
              <p className="font-medium">{event.event_type}</p>
              <p className="text-muted-foreground">{event.reason}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
