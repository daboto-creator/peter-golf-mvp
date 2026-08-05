import type { Metadata } from "next";
import Link from "next/link";

import { OrderList } from "@/components/operations/order-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listManualOrders } from "@/lib/orders/operational-orders";

export const metadata: Metadata = { title: "Pedidos | Peter Golf" };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const scalar = (value: string | string[] | undefined) =>
    typeof value === "string" ? value : undefined;
  const filters = {
    search: scalar(params.q),
    status: scalar(params.status),
    channel: scalar(params.channel),
    payment: scalar(params.payment),
    origin: scalar(params.origin),
  };
  const result = await listManualOrders(filters);
  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium tracking-wide text-emerald-800 uppercase">
            Operación de pedidos
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Pedidos</h1>
          <p className="text-muted-foreground mt-3">
            Hasta 200 pedidos, ordenados del más reciente.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/operacion/pedidos/nuevo">Nuevo pedido</Link>
        </Button>
      </header>
      <form className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]">
        <Input
          name="q"
          defaultValue={filters.search}
          placeholder="Número, cliente, correo o teléfono"
          aria-label="Buscar pedidos"
        />
        <Select
          name="status"
          value={filters.status}
          label="Todos los estados"
          options={[
            ["pending_confirmation", "Preliminar"],
            ["preparing", "Confirmado"],
            ["cancelled", "Cancelado"],
          ]}
        />
        <Select
          name="origin"
          value={filters.origin}
          label="Todos los orígenes"
          options={[
            ["web", "Tienda en línea"],
            ["manual", "Manual"],
          ]}
        />
        <Select
          name="channel"
          value={filters.channel}
          label="Todos los canales"
          options={[
            ["whatsapp", "WhatsApp"],
            ["instagram", "Instagram"],
            ["phone", "Teléfono"],
            ["in_person", "Presencial"],
            ["bank_transfer", "Transferencia"],
            ["other", "Otro"],
          ]}
        />
        <Select
          name="payment"
          value={filters.payment}
          label="Todos los pagos"
          options={[
            ["pending", "Pendiente"],
            ["submitted", "Registrada"],
            ["under_review", "En revisión"],
            ["paid", "Aprobada"],
            ["rejected", "Rechazada"],
            ["failed", "Tarjeta fallida"],
            ["partially_refunded", "Reembolso parcial"],
            ["refunded", "Reembolsada"],
          ]}
        />
        <Button type="submit">Filtrar</Button>
      </form>
      {result.error ? (
        <p className="rounded-xl bg-red-50 p-5 text-red-800">
          No pudimos cargar los pedidos.
        </p>
      ) : result.data.length ? (
        <OrderList orders={result.data} />
      ) : (
        <section className="rounded-xl border border-dashed bg-white p-12 text-center">
          <h2 className="text-xl font-semibold">
            No hay pedidos que coincidan
          </h2>
          <p className="text-muted-foreground mt-2">
            Crea un pedido preliminar o cambia los filtros.
          </p>
        </section>
      )}
    </div>
  );
}

function Select({
  name,
  value,
  label,
  options,
}: {
  name: string;
  value?: string;
  label: string;
  options: string[][];
}) {
  return (
    <select
      name={name}
      defaultValue={value ?? ""}
      aria-label={label}
      className="border-input h-10 rounded-md border px-3 text-sm"
    >
      <option value="">{label}</option>
      {options.map(([key, text]) => (
        <option key={key} value={key}>
          {text}
        </option>
      ))}
    </select>
  );
}
