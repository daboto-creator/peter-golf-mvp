import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";

import { PayableActionForm } from "@/components/marketplace/payable-action-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMarketplacePayablesManager } from "@/lib/auth/marketplace-authorization";
import { formatMoneyMinorUnits } from "@/lib/catalog/presentation";
import {
  placePayableHoldAction,
  releasePayableAction,
  releasePayableHoldAction,
  reversePayableAction,
} from "@/lib/marketplace/partner-finance-actions";
import { getMarketplacePayableForOperations } from "@/lib/marketplace/partner-finance-data";

export default async function MarketplacePayableDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireMarketplacePayablesManager(`/operacion/marketplace/pagos/${id}`);
  const detail = await getMarketplacePayableForOperations(id);
  if (!detail.payable) notFound();
  const remaining =
    Number(detail.payable.original_amount_cents) -
    Number(detail.payable.reversed_amount_cents);
  const activeHolds = detail.holds.filter((hold) => hold.status === "ACTIVE");
  return (
    <div className="space-y-8">
      <header>
        <p className="text-pg-gold text-xs font-semibold uppercase">
          {detail.order?.order_number ?? "Marketplace"}
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Obligación Partner</h1>
        <p className="text-muted-foreground mt-3">
          {detail.payable.status} · versión {detail.payable.version}
        </p>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Payable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Partner: {detail.payable.partner_id}</p>
            <p>Fulfillment: {detail.payable.fulfillment_id}</p>
            <p>Estado fulfillment: {detail.fulfillment?.status}</p>
            <p>
              Monto original:{" "}
              {formatMoneyMinorUnits(
                Number(detail.payable.original_amount_cents),
              )}
            </p>
            <p>
              Revertido:{" "}
              {formatMoneyMinorUnits(
                Number(detail.payable.reversed_amount_cents),
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Snapshot inmutable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{detail.snapshot?.listing_title}</p>
            <p>Tier: {detail.snapshot?.effective_partner_tier}</p>
            <p>Comisión: {detail.snapshot?.commission_rate_bps} bps</p>
            <p>
              Neto Partner:{" "}
              {formatMoneyMinorUnits(
                Number(detail.snapshot?.estimated_partner_net ?? 0),
              )}
            </p>
            <p>Config: {detail.snapshot?.config_version_id}</p>
          </CardContent>
        </Card>
      </div>
      <section className="grid gap-4 xl:grid-cols-3">
        {detail.payable.status !== "REVERSED" &&
        detail.payable.status !== "PAID" ? (
          <PayableActionForm
            action={placePayableHoldAction}
            payableId={id}
            idempotencyKey={randomUUID()}
            label="Poner hold"
            mode="hold"
          />
        ) : null}
        {detail.payable.status === "PENDING" && !activeHolds.length ? (
          <PayableActionForm
            action={releasePayableAction}
            payableId={id}
            idempotencyKey={randomUUID()}
            label="Liberar saldo"
            mode="release"
          />
        ) : null}
        {remaining > 0 &&
        ["PENDING", "ON_HOLD", "AVAILABLE"].includes(detail.payable.status) ? (
          <PayableActionForm
            action={reversePayableAction}
            payableId={id}
            idempotencyKey={randomUUID()}
            label="Registrar reversión"
            mode="reverse"
            maxAmountCents={remaining}
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
              <PayableActionForm
                key={hold.id}
                action={releasePayableHoldAction}
                payableId={id}
                holdId={hold.id}
                idempotencyKey={randomUUID()}
                label={`Liberar ${hold.source}`}
                mode="release-hold"
              />
            ))}
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Ledger append-only</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {detail.ledger.map((entry) => (
            <div
              key={entry.id}
              className="grid gap-1 border-b pb-3 sm:grid-cols-3"
            >
              <p className="font-medium">{entry.entry_type}</p>
              <p>{formatMoneyMinorUnits(Number(entry.amount_cents))}</p>
              <p className="text-muted-foreground">{entry.reason}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
