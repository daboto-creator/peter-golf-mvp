import type { Metadata } from "next";
import Link from "next/link";

import { OrderForm } from "@/components/operations/order-form";
import { listOrderCatalogOptions } from "@/lib/orders/operational-orders";

export const metadata: Metadata = { title: "Nuevo pedido manual | Peter Golf" };

export default async function NewOrderPage() {
  const options = await listOrderCatalogOptions();
  return (
    <div className="space-y-8">
      <header>
        <Link
          href="/operacion/pedidos"
          className="focus-visible:ring-pg-gold inline-flex min-h-11 items-center rounded-lg text-sm font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          ← Volver a pedidos
        </Link>
        <h1 className="text-pg-black mt-4 text-4xl font-semibold tracking-[-0.035em]">
          Nuevo pedido manual
        </h1>
        <p className="text-muted-foreground mt-3 max-w-3xl">
          Crea un preliminar sin reservar ni descontar inventario. El stock se
          valida y descuenta únicamente al confirmar.
        </p>
      </header>
      {options.error ? (
        <p className="rounded-xl bg-red-50 p-5 text-red-800">
          No pudimos cargar el catálogo operativo.
        </p>
      ) : (
        <OrderForm options={options.data} idempotencyKey={randomUUID()} />
      )}
    </div>
  );
}
import { randomUUID } from "node:crypto";
