import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { OrderStateActions } from "@/components/operations/order-actions";
import { PaymentReviewForm } from "@/components/operations/payment-review-form";
import { OrderForm } from "@/components/operations/order-form";
import { Button } from "@/components/ui/button";
import { formatMoneyMinorUnits } from "@/lib/catalog/presentation";
import {
  getManualOrder,
  listOrderCatalogOptions,
} from "@/lib/orders/operational-orders";
import { orderOriginLabel, statusLabel } from "@/lib/orders/presentation";
import {
  paymentMethodLabel,
  paymentStatusLabel,
} from "@/lib/payments/payment-rules";

export const metadata: Metadata = { title: "Detalle de pedido | Peter Golf" };

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [result, options, query] = await Promise.all([
    getManualOrder(id),
    listOrderCatalogOptions(),
    searchParams,
  ]);
  if (result.error)
    return (
      <p className="rounded-xl bg-red-50 p-5 text-red-800">
        No pudimos cargar el pedido.
      </p>
    );
  if (!result.data) notFound();
  const order = result.data;
  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/operacion/pedidos"
            className="text-sm font-medium text-emerald-800 hover:underline"
          >
            ← Volver a pedidos
          </Link>
          <p className="mt-4 text-sm font-medium tracking-wide text-emerald-800 uppercase">
            {statusLabel(order.status)}
          </p>
          <h1 className="mt-2 text-3xl font-semibold">{order.orderNumber}</h1>
          <p className="text-muted-foreground mt-2">
            {orderOriginLabel(order.origin, order.channel)} ·{" "}
            {order.paymentStatus
              ? paymentStatusLabel(order.paymentStatus)
              : "Sin pago asociado"}
          </p>
        </div>
        {order.status === "pending_confirmation" &&
        order.origin === "manual" ? (
          <Button asChild variant="outline">
            <a href="#editar">Editar preliminar</a>
          </Button>
        ) : null}
      </header>
      {query.creado === "1" || query.actualizado === "1" ? (
        <p className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">
          Pedido guardado correctamente.
        </p>
      ) : null}
      <section className="grid gap-5 md:grid-cols-2">
        <Box title="Cliente">
          <p className="font-medium">{order.customerName}</p>
          <p>{order.customerPhone}</p>
          <p>{order.customerEmail ?? "Sin correo"}</p>
        </Box>
        <Box title="Entrega por envío">
          <p>
            {order.address.recipientName} · {order.address.phone}
          </p>
          <p>
            {order.address.street} {order.address.exteriorNumber}
            {order.address.interiorNumber
              ? ` int. ${order.address.interiorNumber}`
              : ""}
          </p>
          <p>
            {order.address.neighborhood}, {order.address.city},{" "}
            {order.address.state}, C.P. {order.address.postalCode}
          </p>
          {order.address.references ? (
            <p className="text-muted-foreground mt-2">
              {order.address.references}
            </p>
          ) : null}
        </Box>
      </section>
      <section className="overflow-hidden rounded-xl border bg-white">
        <div className="border-b p-5">
          <h2 className="text-xl font-semibold">Partidas congeladas</h2>
        </div>
        <ul className="divide-y">
          {order.items.map((item) => (
            <li
              key={item.id}
              className="grid gap-2 p-5 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div>
                <p className="font-medium">
                  {item.productName}
                  {item.variantName ? ` · ${item.variantName}` : ""}
                </p>
                <p className="text-muted-foreground text-sm">
                  SKU {item.sku} · {item.quantity} ×{" "}
                  {formatMoneyMinorUnits(item.unitPrice, order.currency)}
                </p>
              </div>
              <p className="font-semibold">
                {formatMoneyMinorUnits(item.lineTotal, order.currency)}
              </p>
            </li>
          ))}
        </ul>
        <div className="ml-auto grid max-w-md grid-cols-2 gap-2 border-t p-5 text-sm">
          <span>Subtotal</span>
          <strong className="text-right">
            {formatMoneyMinorUnits(order.subtotal, order.currency)}
          </strong>
          <span>
            Descuento{order.discountReason ? ` (${order.discountReason})` : ""}
          </span>
          <strong className="text-right">
            − {formatMoneyMinorUnits(order.discountTotal, order.currency)}
          </strong>
          <span>Envío manual</span>
          <strong className="text-right">
            {formatMoneyMinorUnits(order.shippingTotal, order.currency)}
          </strong>
          <span className="text-lg">Total</span>
          <strong className="text-right text-lg">
            {formatMoneyMinorUnits(order.total, order.currency)}
          </strong>
        </div>
      </section>
      <section className="grid gap-5 md:grid-cols-2">
        <Box title="Auditoría">
          <p>Creado: {date(order.createdAt)}</p>
          <p>Actualizado: {date(order.updatedAt)}</p>
          {order.confirmedAt ? (
            <p>Confirmado: {date(order.confirmedAt)}</p>
          ) : null}
          {order.cancelledAt ? (
            <p>
              Cancelado: {date(order.cancelledAt)} · {order.cancellationReason}
            </p>
          ) : null}
        </Box>
        <Box title="Historial de estados">
          {order.history.map((entry) => (
            <p key={entry.id}>
              {statusLabel(entry.toStatus)} · {date(entry.createdAt)}
            </p>
          ))}
        </Box>
      </section>
      {order.payment ? (
        <Box title="Pago asociado">
          <p>{paymentMethodLabel(order.payment.method)}</p>
          <p>{paymentStatusLabel(order.payment.status)}</p>
          <p>
            Importe esperado:{" "}
            {formatMoneyMinorUnits(
              order.payment.expectedAmount,
              order.payment.currency,
            )}
          </p>
          <p>Versión de pago: {order.payment.version}</p>
        </Box>
      ) : null}
      <PaymentReviewForm
        order={order}
        idempotencyKeys={{
          review: randomUUID(),
          approve: randomUUID(),
          reject: randomUUID(),
          refund: randomUUID(),
        }}
      />
      <OrderStateActions
        order={order}
        confirmKey={randomUUID()}
        cancelKey={randomUUID()}
      />
      {order.status === "pending_confirmation" && order.origin === "manual" ? (
        <section id="editar" className="scroll-mt-4 space-y-5">
          <h2 className="text-2xl font-semibold">Editar preliminar</h2>
          {options.error ? (
            <p>No pudimos cargar las variantes.</p>
          ) : (
            <OrderForm
              options={options.data}
              order={order}
              idempotencyKey={randomUUID()}
            />
          )}
        </section>
      ) : null}
    </div>
  );
}
function Box({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-xl border bg-white p-5">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="space-y-1 text-sm">{children}</div>
    </div>
  );
}
function date(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
