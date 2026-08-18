import type { Metadata } from "next";
import Image from "next/image";
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
    <div className="space-y-8">
      <header className="grid overflow-hidden rounded-[20px] border bg-white md:grid-cols-[1fr_16rem]">
        <div className="flex flex-col justify-center px-6 py-10 sm:px-8">
          <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
            Mi Golf
          </p>
          <h1 className="font-heading text-pg-black mt-3 text-4xl font-bold tracking-[-0.035em]">
            Mis pedidos
          </h1>
          <p className="text-muted-foreground mt-3 leading-7">
            Consulta pedidos, estados y pagos generados desde el Pro Shop.
          </p>
        </div>
        <figure className="relative hidden min-h-48 md:block">
          <Image
            src="/images/home/pro-shop-equipment-temporary.jpg"
            alt="Equipo de golf preparado para jugar"
            fill
            sizes="16rem"
            className="object-cover"
          />
          <figcaption className="sr-only">Imagen editorial</figcaption>
        </figure>
      </header>
      {orders === null ? (
        <p className="rounded-xl bg-red-50 p-5 text-red-800">
          No pudimos cargar tus pedidos.
        </p>
      ) : orders.length ? (
        <ul className="divide-y overflow-hidden rounded-[20px] border bg-white">
          {orders.map((order) => (
            <li
              key={order.id}
              className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div>
                <p className="font-semibold">{order.orderNumber}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
                  <span className="bg-pg-warm-white rounded-lg px-2.5 py-1">
                    {statusLabel(order.status)}
                  </span>
                  <span className="bg-pg-warm-white rounded-lg px-2.5 py-1">
                    {paymentStatusLabel(order.paymentStatus)}
                  </span>
                </div>
                <p className="text-muted-foreground mt-3 text-sm">
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
        <section className="rounded-[20px] border border-dashed bg-white p-10 text-center">
          <h2 className="font-heading text-2xl font-bold">
            Aún no tienes pedidos
          </h2>
          <Button asChild className="mt-5">
            <Link href="/productos">Explorar el Pro Shop</Link>
          </Button>
        </section>
      )}
    </div>
  );
}
