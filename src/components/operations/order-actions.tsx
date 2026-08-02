"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { initialOrderActionResult } from "@/lib/orders/order-action-state";
import {
  cancelManualOrderAction,
  confirmManualOrderAction,
  updateOrderPaymentAction,
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
  if (order.status === "cancelled") return null;
  return (
    <section className="space-y-4 rounded-xl border bg-white p-5 sm:p-6">
      <h2 className="text-xl font-semibold">Acciones de estado</h2>
      {order.status === "pending_confirmation" ? (
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
      ) : null}
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

export function PaymentStateForm({ order }: { order: ManualOrderDetail }) {
  const [state, action, pending] = useActionState(
    updateOrderPaymentAction,
    initialOrderActionResult,
  );
  if (order.status === "cancelled") return null;
  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border bg-white p-5 sm:p-6"
    >
      <h2 className="text-xl font-semibold">Pago informativo</h2>
      <p className="text-muted-foreground text-sm">
        No procesa ni comprueba un pago real y nunca almacena datos de tarjeta.
      </p>
      <input type="hidden" name="orderId" value={order.id} />
      <input type="hidden" name="version" value={order.version} />
      <select
        name="paymentStatus"
        defaultValue={order.paymentStatus}
        className="border-input h-10 w-full rounded-md border px-3 text-sm"
      >
        <option value="pending">Pendiente</option>
        <option value="transfer_pending">
          Transferencia pendiente de verificar
        </option>
        <option value="transfer_verified">
          Transferencia verificada manualmente
        </option>
        <option value="cash_received">Efectivo registrado</option>
        <option value="external_terminal_received">
          Terminal externa registrada
        </option>
      </select>
      {state.status === "error" ? (
        <p role="alert" className="text-sm text-red-700">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Guardando…" : "Actualizar estado informativo"}
      </Button>
    </form>
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
