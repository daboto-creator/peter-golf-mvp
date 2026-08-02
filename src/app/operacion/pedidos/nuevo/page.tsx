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
          className="text-sm font-medium text-emerald-800 hover:underline"
        >
          ← Volver a pedidos
        </Link>
        <h1 className="mt-4 text-3xl font-semibold">Nuevo pedido manual</h1>
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
