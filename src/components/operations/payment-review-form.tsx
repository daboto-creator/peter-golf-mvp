"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import type { ManualOrderDetail } from "@/lib/orders/operational-orders";
import { initialPaymentActionResult } from "@/lib/payments/payment-action-state";
import {
  refundStripePaymentAction,
  reviewOrderPaymentAction,
} from "@/lib/payments/payment-actions";
import {
  paymentProviderLabel,
  paymentStatusLabel,
  stripeCheckoutStatusLabel,
} from "@/lib/payments/payment-rules";

type Keys = {
  review: string;
  approve: string;
  reject: string;
  refund: string;
};

export function PaymentReviewForm({
  order,
  idempotencyKeys,
}: {
  order: ManualOrderDetail;
  idempotencyKeys: Keys;
}) {
  const [state, action, pending] = useActionState(
    reviewOrderPaymentAction,
    initialPaymentActionResult,
  );
  const [stripeRefundState, stripeRefundAction, stripeRefundPending] =
    useActionState(refundStripePaymentAction, initialPaymentActionResult);
  const payment = order.payment;
  if (!payment) {
    return (
      <section className="rounded-xl border bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold">Pago</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Este pedido manual no tiene un pago asociado.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-5 rounded-xl border bg-white p-5 sm:p-6">
      <div>
        <h2 className="text-xl font-semibold">Revisión de pago</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Estado independiente: {paymentStatusLabel(payment.status)}. Ninguna
          acción de pago confirma el pedido o modifica inventario.
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          Proveedor: {paymentProviderLabel(payment.provider)}
          {payment.provider === "stripe"
            ? ` · ${stripeCheckoutStatusLabel(payment.stripeCheckoutStatus)}`
            : ""}
        </p>
      </div>

      {payment.provider === "stripe" ? (
        <div className="space-y-3 rounded-lg bg-blue-50 p-4 text-sm text-blue-950">
          <p>
            Los estados de pagos Stripe sólo cambian mediante webhooks firmados.
            Los reembolsos se solicitan a Stripe y se confirman posteriormente
            mediante webhook.
          </p>

          {payment.status === "paid" && payment.refundedAmount === 0 ? (
            <form action={stripeRefundAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <input
                type="hidden"
                name="idempotencyKey"
                value={idempotencyKeys.refund}
              />
              <Button
                type="submit"
                variant="outline"
                disabled={stripeRefundPending}
              >
                {stripeRefundPending
                  ? "Solicitando reembolso..."
                  : "Reembolsar pago completo en Stripe"}
              </Button>
            </form>
          ) : null}

          {stripeRefundState.message ? (
            <p
              role={stripeRefundState.status === "error" ? "alert" : "status"}
              className={
                stripeRefundState.status === "error"
                  ? "text-red-700"
                  : "text-emerald-800"
              }
            >
              {stripeRefundState.message}
            </p>
          ) : null}
        </div>
      ) : null}

      {payment.provider === "manual" && payment.submissions.length ? (
        <div className="overflow-hidden rounded-lg border">
          <ul className="divide-y text-sm">
            {payment.submissions.map((submission) => (
              <li key={submission.id} className="space-y-1 p-4">
                <p className="font-semibold">
                  Intento {submission.attemptNumber} ·{" "}
                  {submission.transferReference}
                </p>
                <p>
                  Fecha informada: {date(submission.transferredAt)}
                  {submission.senderName ? ` · ${submission.senderName}` : ""}
                  {submission.senderBank ? ` · ${submission.senderBank}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : payment.provider === "manual" ? (
        <p className="text-muted-foreground text-sm">
          El cliente todavía no registra una transferencia simulada.
        </p>
      ) : null}

      {payment.provider === "manual" ? (
        <div className="flex flex-wrap gap-3">
          {payment.status === "submitted" ? (
            <SimpleTransition
              action={action}
              order={order}
              status="under_review"
              idempotencyKey={idempotencyKeys.review}
              label="Iniciar revisión"
              pending={pending}
            />
          ) : null}
          {payment.status === "under_review" ? (
            <SimpleTransition
              action={action}
              order={order}
              status="paid"
              idempotencyKey={idempotencyKeys.approve}
              label="Aprobar pago"
              pending={pending}
            />
          ) : null}
        </div>
      ) : null}

      {payment.provider === "manual" &&
      ["submitted", "under_review"].includes(payment.status) ? (
        <ReasonTransition
          action={action}
          order={order}
          status="rejected"
          idempotencyKey={idempotencyKeys.reject}
          label="Rechazar pago"
          pending={pending}
        />
      ) : null}
      {payment.provider === "manual" && payment.status === "paid" ? (
        <ReasonTransition
          action={action}
          order={order}
          status="refunded"
          idempotencyKey={idempotencyKeys.refund}
          label="Registrar reembolso"
          pending={pending}
        />
      ) : null}

      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={
            state.status === "error"
              ? "text-sm text-red-700"
              : "text-sm text-emerald-800"
          }
        >
          {state.message}
        </p>
      ) : null}

      <div className="space-y-2 border-t pt-4 text-sm">
        <h3 className="font-semibold">Historial de pago</h3>
        {payment.history.map((entry) => (
          <p key={entry.id}>
            {paymentStatusLabel(entry.toStatus)} · {date(entry.createdAt)}
            {entry.note ? ` · ${entry.note}` : ""}
          </p>
        ))}
      </div>
    </section>
  );
}

function Hidden({
  order,
  status,
  idempotencyKey,
}: {
  order: ManualOrderDetail;
  status: "under_review" | "paid" | "rejected" | "refunded";
  idempotencyKey: string;
}) {
  return (
    <>
      <input type="hidden" name="orderId" value={order.id} />
      <input
        type="hidden"
        name="paymentVersion"
        value={order.payment?.version ?? 0}
      />
      <input type="hidden" name="paymentStatus" value={status} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
    </>
  );
}

function SimpleTransition({
  action,
  order,
  status,
  idempotencyKey,
  label,
  pending,
}: {
  action: (payload: FormData) => void;
  order: ManualOrderDetail;
  status: "under_review" | "paid";
  idempotencyKey: string;
  label: string;
  pending: boolean;
}) {
  return (
    <form action={action}>
      <Hidden order={order} status={status} idempotencyKey={idempotencyKey} />
      <Button disabled={pending}>{label}</Button>
    </form>
  );
}

function ReasonTransition({
  action,
  order,
  status,
  idempotencyKey,
  label,
  pending,
}: {
  action: (payload: FormData) => void;
  order: ManualOrderDetail;
  status: "rejected" | "refunded";
  idempotencyKey: string;
  label: string;
  pending: boolean;
}) {
  return (
    <form
      action={action}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <Hidden order={order} status={status} idempotencyKey={idempotencyKey} />
      <label className="flex-1 text-sm font-medium">
        Motivo obligatorio
        <input
          name="reason"
          required
          minLength={3}
          maxLength={500}
          className="border-input mt-2 h-10 w-full rounded-md border px-3 font-normal"
        />
      </label>
      <Button
        variant={status === "rejected" ? "destructive" : "outline"}
        disabled={pending}
      >
        {label}
      </Button>
    </form>
  );
}

function date(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
