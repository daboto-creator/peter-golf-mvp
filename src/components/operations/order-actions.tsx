"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { initialOrderActionResult } from "@/lib/orders/order-action-state";
import {
  cancelManualOrderAction,
  confirmManualOrderAction,
  recordFirstPartyOrderHandoffAction,
} from "@/lib/orders/order-actions";
import type { ManualOrderDetail } from "@/lib/orders/operational-orders";

export function OrderStateActions({
  order,
  confirmKey,
  cancelKey,
  handoffKey = "",
}: {
  order: ManualOrderDetail;
  confirmKey: string;
  cancelKey: string;
  handoffKey?: string;
}) {
  const [confirmState, confirmAction, confirming] = useActionState(
    confirmManualOrderAction,
    initialOrderActionResult,
  );
  const [cancelState, cancelAction, cancelling] = useActionState(
    cancelManualOrderAction,
    initialOrderActionResult,
  );
  const [handoffState, handoffAction, handingOff] = useActionState(
    recordFirstPartyOrderHandoffAction,
    initialOrderActionResult,
  );
  const isAwaitingCheckoutPayment =
    order.origin === "web" && order.payment?.status !== "paid";
  if (order.status === "cancelled") return null;
  return (
    <section className="space-y-4 rounded-xl border bg-white p-5 sm:p-6">
      <h2 className="text-xl font-semibold">Acciones de estado</h2>
      {order.status === "pending_confirmation" ? (
        isAwaitingCheckoutPayment ? (
          <p
            role="status"
            className="rounded-lg bg-blue-50 p-4 text-sm text-blue-950"
          >
            {order.payment?.provider === "stripe"
              ? "Estamos esperando la confirmación del pago por Stripe. El inventario no se descontará hasta que el pago esté confirmado."
              : "Confirma el pago antes de preparar el pedido. El inventario reservado se descontará cuando el pago quede registrado."}
          </p>
        ) : (
          <form
            action={confirmAction}
            onSubmit={(event) => {
              if (
                !confirm(
                  "Confirmar este pedido? El inventario reservado se descontó al confirmarse el pago.",
                )
              )
                event.preventDefault();
            }}
          >
            <Hidden order={order} idempotencyKey={confirmKey} />
            <Button disabled={confirming || !confirmKey}>
              {confirming ? "Confirmando…" : "Confirmar pedido"}
            </Button>
          </form>
        )
      ) : null}
      {order.status === "preparing" &&
      order.payment?.status === "paid" &&
      order.items.length > 0 &&
      order.items.every((item) => item.source === "FIRST_PARTY") ? (
        <form action={handoffAction} className="space-y-3 rounded-lg border p-4">
          <p className="text-sm text-slate-700">
            Registra este paso únicamente cuando el pedido haya sido entregado físicamente al transportista. Después de este punto, un reembolso requiere disposición de Ops.
          </p>
          <Hidden order={order} idempotencyKey={handoffKey} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Transportista
              <input name="carrier" required minLength={2} maxLength={80} className="border-input mt-2 h-11 w-full rounded-xl border px-3 font-normal" />
            </label>
            <label className="text-sm font-medium">
              Número de guía
              <input name="trackingNumber" required minLength={3} maxLength={120} className="border-input mt-2 h-11 w-full rounded-xl border px-3 font-normal" />
            </label>
          </div>
          <Button disabled={handingOff || !handoffKey}>
            {handingOff ? "Registrando…" : "Registrar entrega al transportista"}
          </Button>
        </form>
      ) : null}
      {order.payment?.status === "paid" ? (
        <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-950">
          Registra primero el reembolso del pago para habilitar la cancelación.
        </p>
      ) : (
        <form
          action={cancelAction}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            if (
              !confirm(
                "Cancelar este pedido? La devolución de inventario será automática si ya estaba confirmado.",
              )
            )
              event.preventDefault();
          }}
        >
          <Hidden order={order} idempotencyKey={cancelKey} />
          <label className="flex-1 text-sm font-medium">
            Motivo de cancelación
            <input
              name="reason"
              required
              minLength={3}
              maxLength={500}
              className="border-input focus-visible:ring-pg-gold mt-2 h-11 w-full rounded-xl border px-3 font-normal outline-none focus-visible:ring-2"
            />
          </label>
          <Button variant="destructive" disabled={cancelling || !cancelKey}>
            {cancelling ? "Cancelando…" : "Cancelar pedido"}
          </Button>
        </form>
      )}
      {[confirmState, cancelState, handoffState].map((state, index) =>
        state.status === "error" ? (
          <p
            key={index}
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
          >
            {state.message}
          </p>
        ) : null,
      )}
    </section>
  );
}

function Hidden({
  order,
  idempotencyKey,
}: {
  order: ManualOrderDetail;
  idempotencyKey: string;
}) {
  return (
    <>
      <input type="hidden" name="orderId" value={order.id} />
      <input type="hidden" name="version" value={order.version} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
    </>
  );
}
