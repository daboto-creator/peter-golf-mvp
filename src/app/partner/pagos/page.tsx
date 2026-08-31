import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneyMinorUnits } from "@/lib/catalog/presentation";
import { getPartnerFinanceOverview } from "@/lib/marketplace/partner-finance-data";
import { partnerPayableLabel } from "@/lib/marketplace/partner-finance-rules";
import { getPartnerPayouts } from "@/lib/marketplace/payout-data";
import { payoutStatusLabel } from "@/lib/marketplace/payout-rules";

export default async function PartnerPaymentsPage() {
  const [result, payoutResult] = await Promise.all([
    getPartnerFinanceOverview(),
    getPartnerPayouts(),
  ]);
  const balance = result.balance ?? {
    pending_cents: 0,
    on_hold_cents: 0,
    available_cents: 0,
    paid_historical_cents: 0,
  };
  const cards = [
    ["Pendiente", balance.pending_cents + balance.on_hold_cents],
    ["Disponible para pago", balance.available_cents],
    ["Pagado históricamente", balance.paid_historical_cents],
  ] as const;
  return (
    <div className="space-y-8">
      <header>
        <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
          Portal Partner
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Pagos</h1>
        <p className="text-muted-foreground mt-3 max-w-3xl">
          Consulta de forma clara lo que recibirás por cada venta y el estado de
          tus pagos.
        </p>
      </header>
      {result.error ? (
        <p role="alert" className="text-destructive">
          No pudimos cargar tus movimientos.
        </p>
      ) : null}
      <section
        aria-label="Resumen de pagos"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {cards.map(([label, value]) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {formatMoneyMinorUnits(Number(value))}
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Próximos pagos</h2>
        <p className="text-muted-foreground text-sm">
          Best Round prepara los pagos semanalmente. No necesitas solicitar una
          transferencia.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {payoutResult.payouts.map((payout) => (
            <Card key={payout.payout_id}>
              <CardContent className="space-y-2 p-5">
                <p className="font-semibold">{payout.payout_reference}</p>
                <p className="text-pg-gold text-xs font-semibold uppercase">
                  {payoutStatusLabel(payout.status)}
                </p>
                <p className="text-xl font-semibold">
                  {formatMoneyMinorUnits(Number(payout.total_cents))}
                </p>
                <p className="text-muted-foreground text-sm">
                  {payout.item_count} venta{payout.item_count === 1 ? "" : "s"}
                  {payout.paid_at
                    ? ` · confirmado ${new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(payout.paid_at))}`
                    : ""}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
        {!payoutResult.payouts.length && !payoutResult.error ? (
          <p className="text-muted-foreground rounded-xl border border-dashed bg-white p-8 text-center">
            Aún no hay pagos programados.
          </p>
        ) : null}
      </section>
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Movimientos recientes</h2>
        <div className="grid gap-4">
          {result.payables.map((payable) => (
            <Link
              key={payable.payable_id}
              href={`/partner/pagos/${payable.payable_id}`}
            >
              <Card className="transition hover:border-black">
                <CardContent className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <p className="font-semibold">{payable.listing_title}</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {payable.order_number} ·{" "}
                      {new Intl.DateTimeFormat("es-MX", {
                        dateStyle: "medium",
                      }).format(new Date(payable.created_at))}
                    </p>
                    <p className="text-pg-gold mt-2 text-xs font-semibold uppercase">
                      {partnerPayableLabel(payable.status)}
                    </p>
                  </div>
                  <p className="text-lg font-semibold">
                    {formatMoneyMinorUnits(
                      Number(payable.payable_amount_cents),
                    )}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
        {!result.payables.length && !result.error ? (
          <p className="text-muted-foreground rounded-xl border border-dashed bg-white p-8 text-center">
            Aún no tienes saldos de ventas pagadas.
          </p>
        ) : null}
      </section>
    </div>
  );
}
