import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { requireMarketplacePayablesManager } from "@/lib/auth/marketplace-authorization";
import { formatMoneyMinorUnits } from "@/lib/catalog/presentation";
import { listMarketplacePayablesForOperations } from "@/lib/marketplace/partner-finance-data";

const validStatuses = new Set([
  "PENDING",
  "ON_HOLD",
  "AVAILABLE",
  "PAID",
  "REVERSED",
]);

export default async function MarketplacePayablesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireMarketplacePayablesManager("/operacion/marketplace/pagos");
  const params = await searchParams;
  const statusValue =
    typeof params.status === "string" && validStatuses.has(params.status)
      ? params.status
      : undefined;
  const result = await listMarketplacePayablesForOperations({
    status: statusValue,
    partnerId: typeof params.partner === "string" ? params.partner : undefined,
    orderId: typeof params.order === "string" ? params.order : undefined,
    hasHold: params.hold === "true",
  });
  return (
    <div className="space-y-8">
      <header>
        <p className="text-pg-gold text-xs font-semibold uppercase">
          Marketplace · Operaciones
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Pagos Partner</h1>
        <p className="text-muted-foreground mt-3">
          Obligaciones, holds y movimientos. PR7 no ejecuta transferencias ni
          payouts.
        </p>
      </header>
      <form className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-4">
        <select
          name="status"
          defaultValue={statusValue ?? ""}
          className="border-input h-11 rounded-xl border px-3"
        >
          <option value="">Todos los estados</option>
          {["PENDING", "ON_HOLD", "AVAILABLE", "PAID", "REVERSED"].map(
            (status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ),
          )}
        </select>
        <input
          name="partner"
          placeholder="Partner ID"
          className="border-input h-11 rounded-xl border px-3"
        />
        <input
          name="order"
          placeholder="Order ID"
          className="border-input h-11 rounded-xl border px-3"
        />
        <label className="flex h-11 items-center gap-2 rounded-xl border px-3 text-sm">
          <input name="hold" value="true" type="checkbox" /> Con hold activo
        </label>
        <button className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white md:col-span-4 md:w-fit">
          Filtrar
        </button>
      </form>
      {result.error ? (
        <p role="alert" className="text-destructive">
          No pudimos cargar la cola financiera.
        </p>
      ) : null}
      <div className="grid gap-4">
        {result.data.map((payable) => (
          <Link
            key={payable.id}
            href={`/operacion/marketplace/pagos/${payable.id}`}
          >
            <Card className="transition hover:border-black">
              <CardContent className="grid gap-3 p-5 sm:grid-cols-4 sm:items-center">
                <p className="font-semibold">
                  {payable.orders?.order_number ?? "Orden"}
                </p>
                <p>
                  {payable.marketplace_order_item_snapshots?.listing_title ??
                    "Item Partner"}
                </p>
                <p>{payable.status}</p>
                <p className="sm:text-right">
                  {formatMoneyMinorUnits(Number(payable.original_amount_cents))}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
