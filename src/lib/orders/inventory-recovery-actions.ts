"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOrdersManager } from "@/lib/auth/order-authorization";
import type { PaymentActionResult } from "@/lib/payments/payment-action-state";
import { createClient } from "@/lib/supabase/server";

const uuid = z.uuid();
const positiveVersion = z.coerce.number().int().positive();
const disposition = z.enum([
  "RESTOCKABLE",
  "DAMAGED",
  "MISSING_COMPONENTS",
  "CONDITION_MISMATCH",
  "OTHER",
]);

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function resolveInventoryRecoveryAction(
  _state: PaymentActionResult,
  formData: FormData,
): Promise<PaymentActionResult> {
  const orderId = field(formData, "orderId");
  await requireOrdersManager(`/operacion/pedidos/${orderId}`);

  const parsedOrder = uuid.safeParse(orderId);
  const parsedCase = uuid.safeParse(field(formData, "caseId"));
  const version = positiveVersion.safeParse(field(formData, "caseVersion"));
  const key = uuid.safeParse(field(formData, "idempotencyKey"));
  const choice = disposition.safeParse(field(formData, "disposition"));
  const reason = field(formData, "reason").trim();
  if (
    !parsedOrder.success ||
    !parsedCase.success ||
    !version.success ||
    !key.success ||
    !choice.success ||
    reason.length < 3 ||
    reason.length > 500
  ) {
    return { status: "error", message: "La decisión de recuperación no es válida." };
  }

  const client = await createClient();
  const { error } = await client.rpc("resolve_first_party_inventory_recovery", {
    requested_case_id: parsedCase.data,
    expected_version: version.data,
    requested_disposition: choice.data,
    requested_reason: reason,
    requested_idempotency_key: key.data,
  });
  if (error) {
    const message =
      error.code === "42501"
        ? "No tienes autorización para resolver esta recuperación."
        : error.code === "40001"
          ? "El caso cambió. Recarga la página antes de continuar."
          : error.code === "P0002"
            ? "El caso de recuperación ya no está disponible."
            : "No pudimos guardar la disposición del inventario.";
    return { status: "error", message };
  }

  revalidatePath("/operacion/pedidos");
  revalidatePath(`/operacion/pedidos/${parsedOrder.data}`);
  return {
    status: "success",
    message:
      choice.data === "RESTOCKABLE"
        ? "Artículo aceptado y reintegrado al inventario."
        : "Disposición registrada sin reintegrar inventario.",
  };
}
