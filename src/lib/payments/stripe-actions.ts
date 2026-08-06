"use server";

import { redirect } from "next/navigation";

import { serverEnv } from "@/env/server";
import { requireAuthenticatedUser } from "@/lib/auth/user";
import {
  getStripeCheckoutFailure,
  getStripeCheckoutFormText,
  stripeCheckoutRequestSchema,
  type StripeCheckoutActionResult,
} from "@/lib/payments/stripe-action-rules";
import { getStripeClient } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";

export async function createStripeCheckoutAction(
  _state: StripeCheckoutActionResult,
  formData: FormData,
): Promise<StripeCheckoutActionResult> {
  const parsed = stripeCheckoutRequestSchema.safeParse({
    orderId: getStripeCheckoutFormText(formData, "orderId"),
    idempotencyKey: getStripeCheckoutFormText(formData, "idempotencyKey"),
  });
  if (!parsed.success) {
    return { status: "error", message: "La solicitud de pago no es válida." };
  }
  await requireAuthenticatedUser(`/cuenta/pedidos/${parsed.data.orderId}`);
  if (
    serverEnv.PAYMENTS_MODE !== "test" ||
    serverEnv.STRIPE_CHECKOUT_MODE !== "test"
  ) {
    return {
      status: "error",
      message: "El pago con tarjeta de prueba está deshabilitado.",
    };
  }

  try {
    const client = await createClient();
    const { data, error } = await client.rpc(
      "prepare_stripe_checkout_session",
      {
        requested_order_id: parsed.data.orderId,
        requested_idempotency_key: parsed.data.idempotencyKey,
      },
    );
    const prepared = data?.[0];
    if (error || !prepared) {
      return getStripeCheckoutFailure(error?.code);
    }

    const stripe = getStripeClient();
    let session;
    if (prepared.stripe_checkout_session_id) {
      session = await stripe.checkout.sessions.retrieve(
        prepared.stripe_checkout_session_id,
      );
    } else {
      const expiresAt = Math.ceil(Date.now() / 1000) + 30 * 60;
      session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          payment_method_types: ["card"],
          client_reference_id: parsed.data.orderId,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: prepared.currency.toLowerCase(),
                unit_amount: prepared.amount_minor_units,
                product_data: { name: "Pedido Peter Golf" },
              },
            },
          ],
          expires_at: expiresAt,
          success_url: `${serverEnv.NEXT_PUBLIC_APP_URL}/pagos/stripe/exito?pedido=${parsed.data.orderId}`,
          cancel_url: `${serverEnv.NEXT_PUBLIC_APP_URL}/pagos/stripe/cancelado?pedido=${parsed.data.orderId}`,
          metadata: {
            order_id: parsed.data.orderId,
            payment_id: prepared.payment_id,
            checkout_attempt_id: prepared.checkout_attempt_id,
          },
          payment_intent_data: {
            metadata: {
              order_id: parsed.data.orderId,
              payment_id: prepared.payment_id,
              checkout_attempt_id: prepared.checkout_attempt_id,
            },
          },
        },
        { idempotencyKey: prepared.stripe_idempotency_key },
      );
      const { error: linkError } = await client.rpc(
        "link_stripe_checkout_session",
        {
          requested_checkout_attempt_id: prepared.checkout_attempt_id,
          requested_idempotency_key: prepared.checkout_idempotency_key,
          requested_stripe_checkout_session_id: session.id,
          requested_expires_at: new Date(expiresAt * 1000).toISOString(),
        },
      );
      if (linkError) return getStripeCheckoutFailure(linkError.code);
    }

    if (session.livemode || !session.url) {
      return {
        status: "error",
        message: "Stripe devolvió una sesión de prueba no válida.",
      };
    }
    redirect(session.url);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof error.digest === "string" &&
      error.digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    return {
      status: "error",
      message: "No pudimos abrir Stripe Checkout. Inténtalo nuevamente.",
    };
  }
}
