import { randomUUID } from "node:crypto";
import Link from "next/link";

import { PayoutActionForm } from "@/components/marketplace/payout-action-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMarketplacePayoutsManager } from "@/lib/auth/marketplace-authorization";
import { formatMoneyMinorUnits } from "@/lib/catalog/presentation";
import {
  createPayoutAction,
  runWeeklyPayoutPreparationAction,
} from "@/lib/marketplace/payout-actions";
import { listMarketplacePayablesForOperations } from "@/lib/marketplace/partner-finance-data";
import { listPayoutsForOperations } from "@/lib/marketplace/payout-data";
import { payoutStatusLabel } from "@/lib/marketplace/payout-rules";

const statuses = new Set([
  "DRAFT",
  "READY",
  "ON_HOLD",
  "AWAITING_CONFIRMATION",
  "PAID",
  "FAILED",
  "CANCELLED",
  "RECONCILIATION_REQUIRED",
]);

export default async function MarketplacePayoutsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireMarketplacePayoutsManager("/operacion/marketplace/payouts");
  const params = await searchParams;
  const status =
    typeof params.status === "string" && statuses.has(params.status)
      ? params.status
      : undefined;
  const [result, available] = await Promise.all([
    listPayoutsForOperations({
      status,
      partnerId:
        typeof params.partner === "string" ? params.partner : undefined,
    }),
    listMarketplacePayablesForOperations({ status: "AVAILABLE" }),
  ]);
  const byPartner = Map.groupBy(
    result.error ? [] : available.data,
    (payable) => payable.partner_id,
  );
  const cards = [
    ["Disponible para payout", result.summary.availableCents],
    ["Preparado", result.summary.preparedCents],
    ["Pagado este historial", result.summary.paidCents],
    ["En revisión", result.summary.onHoldCents],
    ["Reconciliación", result.summary.reconciliationCents],
  ] as const;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-8">
      <header>
        <p className="text-pg-gold text-xs font-semibold uppercase">
          Marketplace · Operaciones
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Payouts Partner</h1>
        <p className="text-muted-foreground mt-3">
          Preparación y conciliación de transferencias bancarias externas. Best
          Round no ejecuta movimientos bancarios desde esta aplicación.
        </p>
      </header>
      <section
        aria-label="Resumen de payouts"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
      >
        {cards.map(([label, value]) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{label}</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold">
              {formatMoneyMinorUnits(value)}
            </CardContent>
          </Card>
        ))}
      </section>
      <PayoutActionForm
        action={runWeeklyPayoutPreparationAction}
        label="Preparar candidatos semanales"
        hidden={{
          calculationDate: today,
          executionKey: `manual-weekly:${today}`,
        }}
      />
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">
          Saldos disponibles por Partner
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {[...byPartner.entries()].map(([partnerId, payables]) => (
            <Card key={partnerId}>
              <CardContent className="space-y-4 p-5">
                <p className="font-semibold">Partner {partnerId}</p>
                <p>
                  {payables.length} obligación
                  {payables.length === 1 ? "" : "es"} disponible
                  {payables.length === 1 ? "" : "s"}
                </p>
                <PayoutActionForm
                  action={createPayoutAction}
                  label="Crear payout borrador"
                  hidden={{
                    partnerId,
                    payableIds: payables.map((payable) => payable.id).join(","),
                    idempotencyKey: randomUUID(),
                  }}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <form className="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
        <select
          name="status"
          defaultValue={status ?? ""}
          className="border-input h-11 rounded-xl border px-3"
        >
          <option value="">Todos los estados</option>
          {[...statuses].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <input
          name="partner"
          placeholder="Partner ID"
          className="border-input h-11 rounded-xl border px-3"
        />
        <button className="rounded-xl bg-black px-4 text-sm font-medium text-white">
          Filtrar
        </button>
      </form>
      <div className="grid gap-4">
        {result.data.map((payout) => (
          <Link
            key={payout.id}
            href={`/operacion/marketplace/payouts/${payout.id}`}
          >
            <Card className="transition hover:border-black">
              <CardContent className="grid gap-3 p-5 sm:grid-cols-5 sm:items-center">
                <p className="font-semibold">{payout.payout_reference}</p>
                <p>{payout.partner_id}</p>
                <p>{payoutStatusLabel(payout.status)}</p>
                <p>{payout.item_count} items</p>
                <p className="sm:text-right">
                  {formatMoneyMinorUnits(Number(payout.total_cents))}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
