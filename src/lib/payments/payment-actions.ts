"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { serverEnv } from "@/env/server";
import { requireOrdersManager } from "@/lib/auth/order-authorization";
import { requireAuthenticatedUser } from "@/lib/auth/user";
import type { PaymentActionResult } from "@/lib/payments/payment-action-state";
import {
  parseBankTransferForm,
  paymentStatuses,
} from "@/lib/payments/payment-rules";
import { getStripeClient } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";

const uuid = z.uuid();
const version = z.coerce.number().int().positive();
const reviewStatus = z
  .enum(paymentStatuses)
  .refine((status) =>
    ["under_review", "paid", "rejected", "refunded"].includes(status),
  );

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function failure(code?: string): PaymentActionResult {
  if (code === "40001") {
    return {
      status: "error",
      message: "El pago cambió. Recarga la página antes de continuar.",
    };
  }
  if (code === "23505") {
    return {
      status: "error",
      message: "La solicitud se reutilizó con datos diferentes.",
    };
  }
  if (code === "22023" || code === "23514") {
    return {
      status: "error",
      message: "Los datos o la transición del pago ya no son válidos.",
    };
  }
  if (code === "42501") {
    return {
      status: "error",
      message: "El registro de transferencias está deshabilitado.",
    };
  }
  if (code === "P0002") {
    return { status: "error", message: "El pago ya no está disponible." };
  }
  return {
    status: "error",
    message: "No pudimos actualizar el pago. Inténtalo nuevamente.",
  };
}

export async function submitBankTransferAction(
  _state: PaymentActionResult,
  formData: FormData,
): Promise<PaymentActionResult> {
  const orderId = text(formData, "orderId");
  await requireAuthenticatedUser(`/cuenta/pedidos/${orderId}`);
  if (serverEnv.PAYMENTS_MODE !== "test") {
    return {
      status: "error",
      message: "El registro de transferencias está deshabilitado.",
    };
  }
  const parsedOrderId = uuid.safeParse(orderId);
  const parsedVersion = version.safeParse(text(formData, "paymentVersion"));
  const key = uuid.safeParse(text(formData, "idempotencyKey"));
  const submission = parseBankTransferForm(formData);
  if (
    !parsedOrderId.success ||
    !parsedVersion.success ||
    !key.success ||
    !submission.success
  ) {
    return {
      status: "error",
      message: submission.success
        ? "La solicitud de pago no es válida."
        : submission.message,
    };
  }
  const client = await createClient();
  const { error } = await client.rpc("submit_bank_transfer", {
    requested_order_id: parsedOrderId.data,
    expected_payment_version: parsedVersion.data,
    requested_transfer_reference: submission.data.transferReference,
    requested_transferred_at: submission.data.transferredAt,
    requested_sender_name: submission.data.senderName ?? "",
    requested_sender_bank: submission.data.senderBank ?? "",
    requested_idempotency_key: key.data,
  });
  if (error) return failure(error.code);
  revalidatePath("/cuenta/pedidos");
  revalidatePath(`/cuenta/pedidos/${parsedOrderId.data}`);
  revalidatePath(`/pedido-confirmado/${parsedOrderId.data}`);
  revalidatePath("/operacion/pedidos");
  revalidatePath(`/operacion/pedidos/${parsedOrderId.data}`);
  return {
    status: "success",
    message: "Transferencia simulada registrada para revisión.",
  };
}

export async function refundStripePaymentAction(
  _state: PaymentActionResult,
  formData: FormData,
): Promise<PaymentActionResult> {
  const orderId = text(formData, "orderId");
  await requireOrdersManager(`/operacion/pedidos/${orderId}`);

  if (
    serverEnv.PAYMENTS_MODE !== "test" ||
    serverEnv.STRIPE_CHECKOUT_MODE !== "test"
  ) {
    return {
      status: "error",
      message: "Los reembolsos Stripe de prueba están deshabilitados.",
    };
  }

  const parsedOrderId = uuid.safeParse(orderId);
  const key = uuid.safeParse(text(formData, "idempotencyKey"));
  if (!parsedOrderId.success || !key.success) {
    return {
      status: "error",
      message: "La solicitud de reembolso no es válida.",
    };
  }

  try {
    const client = await createClient();

    const { data: order, error } = await client
      .from("orders")
      .select(
        "id, order_payments!inner(id, provider, status, expected_amount, refunded_amount, stripe_checkout_sessions(stripe_payment_intent_id, status, completed_at, created_at))",
      )
      .eq("id", parsedOrderId.data)
      .maybeSingle();

    if (error || !order?.order_payments) {
      return {
        status: "error",
        message: "El pago ya no está disponible.",
      };
    }

    const payment = order.order_payments;

    if (
      payment.provider !== "stripe" ||
      payment.status !== "paid" ||
      payment.refunded_amount !== 0
    ) {
      return {
        status: "error",
        message: "Este pago Stripe no está disponible para reembolso total.",
      };
    }

    const completedSession = payment.stripe_checkout_sessions
      .filter(
        (session) =>
          session.status === "completed" &&
          Boolean(session.completed_at) &&
          Boolean(session.stripe_payment_intent_id),
      )
      .toSorted((a, b) => b.created_at.localeCompare(a.created_at))[0];

    if (!completedSession?.stripe_payment_intent_id) {
      return {
        status: "error",
        message: "No encontramos el pago confirmado en Stripe.",
      };
    }

    const stripe = getStripeClient();

    await stripe.refunds.create(
      {
        payment_intent: completedSession.stripe_payment_intent_id,
        metadata: {
          order_id: parsedOrderId.data,
          payment_id: payment.id,
        },
      },
      {
        idempotencyKey: `pg_full_refund_${payment.id}`,
      },
    );

    revalidatePath("/operacion/pedidos");
    revalidatePath(`/operacion/pedidos/${parsedOrderId.data}`);
    revalidatePath("/cuenta/pedidos");
    revalidatePath(`/cuenta/pedidos/${parsedOrderId.data}`);

    return {
      status: "success",
      message:
        "Reembolso solicitado a Stripe. El estado se actualizará mediante webhook.",
    };
  } catch {
    return {
      status: "error",
      message: "No pudimos solicitar el reembolso en Stripe.",
    };
  }
}

export async function reviewOrderPaymentAction(
  _state: PaymentActionResult,
  formData: FormData,
): Promise<PaymentActionResult> {
  const orderId = text(formData, "orderId");
  await requireOrdersManager(`/operacion/pedidos/${orderId}`);
  const parsedOrderId = uuid.safeParse(orderId);
  const parsedVersion = version.safeParse(text(formData, "paymentVersion"));
  const key = uuid.safeParse(text(formData, "idempotencyKey"));
  const status = reviewStatus.safeParse(text(formData, "paymentStatus"));
  const reason = text(formData, "reason").trim();
  if (
    !parsedOrderId.success ||
    !parsedVersion.success ||
    !key.success ||
    !status.success ||
    (["rejected", "refunded"].includes(status.data) &&
      (reason.length < 3 || reason.length > 500)) ||
    (!["rejected", "refunded"].includes(status.data) && reason)
  ) {
    return { status: "error", message: "La revisión del pago no es válida." };
  }
  const client = await createClient();
  const { error } = await client.rpc("review_order_payment", {
    requested_order_id: parsedOrderId.data,
    expected_payment_version: parsedVersion.data,
    requested_status: status.data,
    requested_reason: reason,
    requested_idempotency_key: key.data,
  });
  if (error) return failure(error.code);
  revalidatePath("/operacion/pedidos");
  revalidatePath(`/operacion/pedidos/${parsedOrderId.data}`);
  revalidatePath("/cuenta/pedidos");
  revalidatePath(`/cuenta/pedidos/${parsedOrderId.data}`);
  return { status: "success", message: "Estado del pago actualizado." };
}
