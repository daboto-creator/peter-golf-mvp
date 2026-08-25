import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneyMinorUnits } from "@/lib/catalog/presentation";
import { getPartnerFinanceOverview } from "@/lib/marketplace/partner-finance-data";
import { partnerPayableLabel } from "@/lib/marketplace/partner-finance-rules";

export default async function PartnerPaymentsPage() {
  const result = await getPartnerFinanceOverview();
  const balance = result.balance ?? {
    pending_cents: 0,
    on_hold_cents: 0,
    available_cents: 0,
    paid_historical_cents: 0,
  };
  const cards = [
    ["Saldo pendiente", balance.pending_cents],
    ["En revisión", balance.on_hold_cents],
    ["Disponible para próximo pago", balance.available_cents],
    ["Pagos realizados", balance.paid_historical_cents],
  ] as const;
  return (
    <div className="space-y-8">
      <header>
        <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
          Portal Partner
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Pagos</h1>
        <p className="text-muted-foreground mt-3 max-w-3xl">
          Consulta lo generado por tus ventas. Best Round registra cada
          movimiento y conserva los fondos hasta que exista una liberación
          autorizada.
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
