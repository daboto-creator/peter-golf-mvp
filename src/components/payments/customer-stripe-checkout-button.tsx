"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  createStripeCheckoutAction,
  initialStripeCheckoutActionResult,
} from "@/lib/payments/stripe-actions";

export function CustomerStripeCheckoutButton({
  orderId,
  idempotencyKey,
  enabled,
}: {
  orderId: string;
  idempotencyKey: string;
  enabled: boolean;
}) {
  const [state, action, pending] = useActionState(
    createStripeCheckoutAction,
    initialStripeCheckoutActionResult,
  );
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <Button
        type="submit"
        size="lg"
        className="w-full sm:w-auto"
        disabled={!enabled || pending}
      >
        {pending ? "Preparando sesión…" : "Pagar con tarjeta de prueba"}
      </Button>
      <p className="text-muted-foreground text-xs">
        Abrirás Stripe Checkout alojado. Usa únicamente tarjetas de prueba.
      </p>
      {state.message ? (
        <p role="alert" aria-live="assertive" className="text-sm text-red-700">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
