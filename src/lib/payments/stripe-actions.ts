"use server";

import { redirect } from "next/navigation";
import type Stripe from "stripe";

import { serverEnv } from "@/env/server";
import { requireAuthenticatedUser } from "@/lib/auth/user";
import {
  getStripeCheckoutExpiresAt,
  getStripeCheckoutFailure,
  getStripeCheckoutFormText,
  sanitizeStripeCheckoutError,
  stripeCheckoutRequestSchema,
  type StripeCheckoutActionResult,
  type StripeCheckoutDiagnosticStage,
} from "@/lib/payments/stripe-action-rules";
import { getStripeClient } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type PreparedStripeCheckout =
  Database["public"]["Functions"]["prepare_stripe_checkout_session"]["Returns"][number];

function logStripeCheckoutError(
  stage: StripeCheckoutDiagnosticStage,
  error: unknown,
) {
  console.error(
    "Stripe Checkout diagnostic",
    sanitizeStripeCheckoutError(error, stage),
  );
}

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

  let client: Awaited<ReturnType<typeof createClient>>;
  let prepared: PreparedStripeCheckout | undefined;
  try {
    client = await createClient();
    const { data, error } = await client.rpc(
      "prepare_stripe_checkout_session",
      {
        requested_order_id: parsed.data.orderId,
        requested_idempotency_key: parsed.data.idempotencyKey,
      },
    );
    prepared = data?.[0];
    if (error || !prepared) {
      logStripeCheckoutError(
        "prepare",
        error ?? { code: "missing_prepared_checkout" },
      );
      return getStripeCheckoutFailure(error?.code);
    }
  } catch (error) {
    logStripeCheckoutError("prepare", error);
    return getStripeCheckoutFailure();
  }

  let session: Stripe.Checkout.Session;
  try {
    const stripe = getStripeClient();
    if (prepared.stripe_checkout_session_id) {
      session = await stripe.checkout.sessions.retrieve(
        prepared.stripe_checkout_session_id,
      );
    } else {
      const expiresAt = getStripeCheckoutExpiresAt();
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
                product_data: { name: "Pedido Best Round Pro Shop" },
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
      try {
        const { error: linkError } = await client.rpc(
          "link_stripe_checkout_session",
          {
            requested_checkout_attempt_id: prepared.checkout_attempt_id,
            requested_idempotency_key: prepared.checkout_idempotency_key,
            requested_stripe_checkout_session_id: session.id,
            requested_expires_at: new Date(expiresAt * 1000).toISOString(),
          },
        );
        if (linkError) {
          logStripeCheckoutError("attach", linkError);
          return getStripeCheckoutFailure(linkError.code);
        }
      } catch (error) {
        logStripeCheckoutError("attach", error);
        return getStripeCheckoutFailure();
      }
    }
  } catch (error) {
    logStripeCheckoutError("stripe_create", error);
    return {
      status: "error",
      message: "No pudimos abrir Stripe Checkout. Inténtalo nuevamente.",
    };
  }

  if (session.livemode || !session.url) {
    logStripeCheckoutError("redirect", {
      code: session.livemode ? "live_mode_session" : "missing_session_url",
    });
    return {
      status: "error",
      message: "No pudimos abrir Stripe Checkout. Inténtalo nuevamente.",
    };
  }

  redirect(session.url);
}
