"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireOrdersManager } from "@/lib/auth/order-authorization";
import type { OrderActionResult } from "@/lib/orders/order-action-state";
import { parseManualOrderForm } from "@/lib/orders/order-rules";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

const uuid = z.uuid();
const version = z.coerce.number().int().positive();

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item : "";
}

function failure(code?: string): OrderActionResult {
  if (code === "40001")
    return {
      status: "error",
      message: "El pedido cambió. Recarga la página antes de continuar.",
    };
  if (code === "23514")
    return {
      status: "error",
      message:
        "No hay existencias suficientes o los importes ya no son válidos.",
    };
  if (code === "23505")
    return {
      status: "error",
      message:
        "La solicitud ya fue usada con datos diferentes. Recarga e inténtalo de nuevo.",
    };
  if (code === "22023")
    return {
      status: "error",
      message: "El pedido o la transición ya no es válida.",
    };
  if (code === "P0002")
    return { status: "error", message: "El pedido ya no está disponible." };
  return {
    status: "error",
    message: "No pudimos guardar el pedido. Inténtalo nuevamente.",
  };
}

export async function createManualOrderAction(
  _state: OrderActionResult,
  formData: FormData,
): Promise<OrderActionResult> {
  await requireOrdersManager("/operacion/pedidos/nuevo");
  const parsed = parseManualOrderForm(formData);
  if (!parsed.success) return { status: "error", message: parsed.message };
  const client = await createClient();
  const { data, error } = await client.rpc("create_manual_order", {
    requested_idempotency_key:
      value(formData, "idempotencyKey") || randomUUID(),
    requested_payload: { ...parsed.data },
  });
  if (error || !data[0]) return failure(error?.code);
  revalidatePath("/operacion");
  revalidatePath("/operacion/pedidos");
  redirect(`/operacion/pedidos/${data[0].order_id}?creado=1`);
}

export async function updateManualOrderAction(
  _state: OrderActionResult,
  formData: FormData,
): Promise<OrderActionResult> {
  const orderId = value(formData, "orderId");
  await requireOrdersManager(`/operacion/pedidos/${orderId}`);
  const parsedId = uuid.safeParse(orderId);
  const parsedVersion = version.safeParse(value(formData, "version"));
  const parsed = parseManualOrderForm(formData);
  if (!parsedId.success || !parsedVersion.success || !parsed.success) {
    return {
      status: "error",
      message: parsed.success ? "El pedido no es válido." : parsed.message,
    };
  }
  const client = await createClient();
  const { error } = await client.rpc("update_manual_order_draft", {
    requested_order_id: parsedId.data,
    expected_version: parsedVersion.data,
    requested_payload: { ...parsed.data },
  });
  if (error) return failure(error.code);
  revalidatePath("/operacion/pedidos");
  revalidatePath(`/operacion/pedidos/${parsedId.data}`);
  redirect(`/operacion/pedidos/${parsedId.data}?actualizado=1`);
}

export async function confirmManualOrderAction(
  _state: OrderActionResult,
  formData: FormData,
): Promise<OrderActionResult> {
  return transition(formData, "confirm");
}

export async function cancelManualOrderAction(
  _state: OrderActionResult,
  formData: FormData,
): Promise<OrderActionResult> {
  return transition(formData, "cancel");
}

async function transition(
  formData: FormData,
  operation: "confirm" | "cancel",
): Promise<OrderActionResult> {
  const orderId = value(formData, "orderId");
  await requireOrdersManager(`/operacion/pedidos/${orderId}`);
  const parsedId = uuid.safeParse(orderId);
  const parsedVersion = version.safeParse(value(formData, "version"));
  const key = uuid.safeParse(value(formData, "idempotencyKey"));
  if (!parsedId.success || !parsedVersion.success || !key.success) {
    return { status: "error", message: "La solicitud no es válida." };
  }
  const client = await createClient();
  const result =
    operation === "confirm"
      ? await client.rpc("confirm_manual_order", {
          requested_order_id: parsedId.data,
          expected_version: parsedVersion.data,
          requested_idempotency_key: key.data,
        })
      : await client.rpc("cancel_manual_order", {
          requested_order_id: parsedId.data,
          expected_version: parsedVersion.data,
          requested_idempotency_key: key.data,
          requested_reason: value(formData, "reason"),
        });
  if (result.error) return failure(result.error.code);
  revalidatePath("/operacion/pedidos");
  revalidatePath(`/operacion/pedidos/${parsedId.data}`);
  revalidatePath("/operacion/inventario");
  return { status: "idle", message: "" };
}

const paymentPairs: Record<
  Database["public"]["Enums"]["manual_payment_status"],
  Database["public"]["Enums"]["manual_payment_method"]
> = {
  pending: "none",
  transfer_pending: "bank_transfer",
  transfer_verified: "bank_transfer",
  cash_received: "cash",
  external_terminal_received: "external_terminal",
};

export async function updateOrderPaymentAction(
  _state: OrderActionResult,
  formData: FormData,
): Promise<OrderActionResult> {
  const orderId = value(formData, "orderId");
  await requireOrdersManager(`/operacion/pedidos/${orderId}`);
  const parsedId = uuid.safeParse(orderId);
  const parsedVersion = version.safeParse(value(formData, "version"));
  const status = value(formData, "paymentStatus") as keyof typeof paymentPairs;
  if (
    !parsedId.success ||
    !parsedVersion.success ||
    !(status in paymentPairs)
  ) {
    return { status: "error", message: "El estado informativo no es válido." };
  }
  const client = await createClient();
  const { error } = await client.rpc("update_manual_order_payment", {
    requested_order_id: parsedId.data,
    expected_version: parsedVersion.data,
    requested_status: status,
    requested_method: paymentPairs[status],
  });
  if (error) return failure(error.code);
  revalidatePath("/operacion/pedidos");
  revalidatePath(`/operacion/pedidos/${parsedId.data}`);
  return { status: "idle", message: "" };
}
