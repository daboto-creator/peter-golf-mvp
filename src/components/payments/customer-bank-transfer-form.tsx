"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CustomerOrderDetail } from "@/lib/orders/customer-orders";
import { formatMoneyMinorUnits } from "@/lib/catalog/presentation";
import { initialPaymentActionResult } from "@/lib/payments/payment-action-state";
import { submitBankTransferAction } from "@/lib/payments/payment-actions";
import {
  paymentMethodLabel,
  paymentStatusLabel,
} from "@/lib/payments/payment-rules";

export function CustomerBankTransferForm({
  order,
  paymentsMode,
  idempotencyKey,
}: {
  order: CustomerOrderDetail;
  paymentsMode: "disabled" | "test";
  idempotencyKey: string;
}) {
  const [state, action, pending] = useActionState(
    submitBankTransferAction,
    initialPaymentActionResult,
  );
  const canSubmit =
    paymentsMode === "test" &&
    order.status === "preparing" &&
    ["pending", "rejected"].includes(order.paymentStatus);

  return (
    <section className="space-y-5 rounded-xl border bg-white p-5 sm:p-6">
      <div>
        <p className="text-sm font-medium tracking-wide text-emerald-800 uppercase">
          {paymentMethodLabel(order.paymentMethod)}
        </p>
        <h2 className="mt-2 text-xl font-semibold">Pago del pedido</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Estado: {paymentStatusLabel(order.paymentStatus)}
        </p>
      </div>

      <dl className="grid gap-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Importe exacto</dt>
          <dd className="font-semibold">
            {formatMoneyMinorUnits(
              order.paymentExpectedAmount,
              order.paymentCurrency,
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Moneda</dt>
          <dd className="font-semibold">{order.paymentCurrency}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Referencia sugerida</dt>
          <dd className="font-semibold">{order.orderNumber}</dd>
        </div>
      </dl>

      {paymentsMode === "disabled" ? (
        <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-950">
          El registro de transferencias está deshabilitado. No envíes dinero ni
          compartas información bancaria.
        </p>
      ) : (
        <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-950">
          <strong>Simulación de prueba.</strong> Usa una referencia ficticia y
          datos no reales. <strong>No realizar una transferencia real.</strong>
          No se proporciona una cuenta bancaria y este flujo no procesa dinero.
        </div>
      )}

      {paymentsMode === "test" && order.status !== "preparing" ? (
        <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-950">
          Operaciones debe confirmar primero el pedido y descontar el
          inventario. El formulario se habilitará después de esa confirmación.
        </p>
      ) : null}

      {canSubmit ? (
        <form action={action} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="orderId" value={order.id} />
          <input
            type="hidden"
            name="paymentVersion"
            value={order.paymentVersion}
          />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <label className="space-y-2 text-sm font-medium sm:col-span-2">
            <span>Referencia de transferencia simulada</span>
            <Input
              name="transferReference"
              required
              minLength={3}
              maxLength={120}
              autoComplete="off"
            />
          </label>
          <label className="space-y-2 text-sm font-medium">
            <span>Fecha de transferencia simulada</span>
            <Input name="transferDate" type="date" required />
          </label>
          <label className="space-y-2 text-sm font-medium">
            <span>Nombre del remitente (opcional)</span>
            <Input name="senderName" minLength={2} maxLength={120} />
          </label>
          <label className="space-y-2 text-sm font-medium sm:col-span-2">
            <span>Banco emisor (opcional)</span>
            <Input name="senderBank" minLength={2} maxLength={120} />
          </label>
          <p className="text-muted-foreground text-xs sm:col-span-2">
            No solicites ni escribas cuenta origen, CLABE, tarjeta, CVV,
            contraseñas ni credenciales financieras.
          </p>
          {state.message ? (
            <p
              role={state.status === "error" ? "alert" : "status"}
              className={
                state.status === "error"
                  ? "text-sm text-red-700 sm:col-span-2"
                  : "text-sm text-emerald-800 sm:col-span-2"
              }
            >
              {state.message}
            </p>
          ) : null}
          <Button type="submit" disabled={pending} className="sm:w-fit">
            {pending ? "Registrando…" : "Registrar transferencia simulada"}
          </Button>
        </form>
      ) : null}

      {order.paymentSubmissions.length ? (
        <div className="space-y-2 border-t pt-4 text-sm">
          <h3 className="font-semibold">Intentos registrados</h3>
          {order.paymentSubmissions.map((submission) => (
            <p key={submission.attemptNumber}>
              Intento {submission.attemptNumber} ·{" "}
              {submission.transferReference}
              {" · "}
              {new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(
                new Date(submission.transferredAt),
              )}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}
