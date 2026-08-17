"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { initialOrderActionResult } from "@/lib/orders/order-action-state";
import {
  cancelManualOrderAction,
  confirmManualOrderAction,
} from "@/lib/orders/order-actions";
import type { ManualOrderDetail } from "@/lib/orders/operational-orders";

export function OrderStateActions({
  order,
  confirmKey,
  cancelKey,
}: {
  order: ManualOrderDetail;
  confirmKey: string;
  cancelKey: string;
}) {
  const [confirmState, confirmAction, confirming] = useActionState(
    confirmManualOrderAction,
    initialOrderActionResult,
  );
  const [cancelState, cancelAction, cancelling] = useActionState(
    cancelManualOrderAction,
    initialOrderActionResult,
  );
  const isAwaitingStripePayment =
    order.payment?.provider === "stripe" && order.payment.status !== "paid";
  if (order.status === "cancelled") return null;
  return (
    <section className="space-y-4 rounded-xl border bg-white p-5 sm:p-6">
      <h2 className="text-xl font-semibold">Acciones de estado</h2>
      {order.status === "pending_confirmation" ? (
        isAwaitingStripePayment ? (
          <p
            role="status"
            className="rounded-lg bg-blue-50 p-4 text-sm text-blue-950"
          >
            Estamos esperando la confirmación del pago por Stripe. El inventario
            no se descontará hasta que el pago esté confirmado.
          </p>
        ) : (
          <form
            action={confirmAction}
            onSubmit={(event) => {
              if (
                !confirm(
                  "Confirmar este pedido y descontar todo el inventario ahora?",
                )
              )
                event.preventDefault();
            }}
          >
            <Hidden order={order} idempotencyKey={confirmKey} />
            <Button disabled={confirming || !confirmKey}>
              {confirming ? "Confirmando…" : "Confirmar y descontar inventario"}
            </Button>
          </form>
        )
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
              className="border-input mt-2 h-10 w-full rounded-md border px-3 font-normal"
            />
          </label>
          <Button variant="destructive" disabled={cancelling || !cancelKey}>
            {cancelling ? "Cancelando…" : "Cancelar pedido"}
          </Button>
        </form>
      )}
      {[confirmState, cancelState].map((state, index) =>
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
