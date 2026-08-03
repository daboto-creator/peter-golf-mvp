import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { formatMoneyMinorUnits } from "@/lib/catalog/presentation";
import { listCustomerOrders } from "@/lib/orders/customer-orders";
import { statusLabel } from "@/lib/orders/presentation";
import { paymentStatusLabel } from "@/lib/payments/payment-rules";

export const metadata: Metadata = { title: "Mis pedidos | Peter Golf" };

export default async function CustomerOrdersPage() {
  const orders = await listCustomerOrders();
  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-3xl font-semibold">Mis pedidos</h1>
        <p className="text-muted-foreground mt-2">
          Consulta pedidos generados desde la tienda en línea.
        </p>
      </header>
      {orders === null ? (
        <p className="rounded-xl bg-red-50 p-5 text-red-800">
          No pudimos cargar tus pedidos.
        </p>
      ) : orders.length ? (
        <ul className="divide-y overflow-hidden rounded-xl border bg-white">
          {orders.map((order) => (
            <li
              key={order.id}
              className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div>
                <p className="font-semibold">{order.orderNumber}</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {statusLabel(order.status)} ·{" "}
                  {paymentStatusLabel(order.paymentStatus)} ·{" "}
                  {new Intl.DateTimeFormat("es-MX", {
                    dateStyle: "medium",
                  }).format(new Date(order.createdAt))}
                </p>
                <p className="mt-2 font-medium">
                  {formatMoneyMinorUnits(order.total, order.currency)}
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href={`/cuenta/pedidos/${order.id}`}>Ver detalle</Link>
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <section className="rounded-xl border border-dashed bg-white p-10 text-center">
          <h2 className="text-xl font-semibold">Aún no tienes pedidos</h2>
          <Button asChild className="mt-5">
            <Link href="/productos">Explorar productos</Link>
          </Button>
        </section>
      )}
    </div>
  );
}
