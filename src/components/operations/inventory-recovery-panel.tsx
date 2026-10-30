"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import type { ManualOrderDetail } from "@/lib/orders/operational-orders";
import { initialPaymentActionResult } from "@/lib/payments/payment-action-state";
import { resolveInventoryRecoveryAction } from "@/lib/orders/inventory-recovery-actions";

const statusLabel: Record<string, string> = {
  PENDING: "Pendiente de disposición física",
  RESTOCKED: "Reintegrado al inventario",
  NOT_RESTOCKED: "Cerrado sin reintegrar",
  NOT_REQUIRED: "No requiere recuperación",
};

function RecoveryCase({
  orderId,
  recoveryCase,
  idempotencyKey,
}: {
  orderId: string;
  recoveryCase: ManualOrderDetail["recoveryCases"][number];
  idempotencyKey: string;
}) {
  const [state, action, pending] = useActionState(
    resolveInventoryRecoveryAction,
    initialPaymentActionResult,
  );

  return (
    <li className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{recoveryCase.productName}</p>
          <p className="text-muted-foreground text-sm">
            First Party · {recoveryCase.quantity} unidad(es) · fulfillment: {recoveryCase.fulfillmentStatus ?? "sin fulfillment"}
          </p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-sm">
          {statusLabel[recoveryCase.status] ?? recoveryCase.status}
        </span>
      </div>
      <p className="text-sm">
        Pago: {recoveryCase.paymentStatus} · reembolsado: {recoveryCase.refundedAmount}
      </p>
      {recoveryCase.reason ? (
        <p className="text-muted-foreground text-sm">Motivo: {recoveryCase.reason}</p>
      ) : null}
      {recoveryCase.status === "PENDING" ? (
        <form action={action} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="caseId" value={recoveryCase.id} />
          <input type="hidden" name="caseVersion" value={recoveryCase.version} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <label className="grid gap-1 text-sm">
            Disposición
            <select name="disposition" required className="min-h-10 rounded-md border bg-white px-3">
              <option value="RESTOCKABLE">Restockable</option>
              <option value="DAMAGED">Dañado</option>
              <option value="MISSING_COMPONENTS">Componentes faltantes</option>
              <option value="CONDITION_MISMATCH">Condición distinta</option>
              <option value="OTHER">Otro motivo</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Motivo / inspección
            <input name="reason" minLength={3} maxLength={500} required className="min-h-10 rounded-md border px-3" />
          </label>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Resolver"}
          </Button>
        </form>
      ) : null}
      {state.message ? (
        <p role={state.status === "error" ? "alert" : "status"} className="text-sm">
          {state.message}
        </p>
      ) : null}
    </li>
  );
}

export function InventoryRecoveryPanel({
  order,
  idempotencyKeys,
}: {
  order: ManualOrderDetail;
  idempotencyKeys: Record<string, string>;
}) {
  return (
    <section className="space-y-4 rounded-xl border bg-white p-5 sm:p-6">
      <div>
        <h2 className="text-xl font-semibold">Recuperación de inventario</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Un reembolso no devuelve automáticamente al inventario los artículos que ya cruzaron el handoff.
          Ops debe confirmar la condición física.
        </p>
      </div>
      {order.recoveryCases.length ? (
        <ul className="space-y-3">
          {order.recoveryCases.map((recoveryCase) => (
            <RecoveryCase
              key={recoveryCase.id}
              orderId={order.id}
              recoveryCase={recoveryCase}
              idempotencyKey={idempotencyKeys[recoveryCase.id] ?? ""}
            />
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">No hay casos de recuperación para este pedido.</p>
      )}
    </section>
  );
}
