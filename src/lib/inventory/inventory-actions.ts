"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCatalogManager } from "@/lib/auth/catalog-authorization";
import type { InventoryActionResult } from "@/lib/inventory/inventory-action-state";
import {
  getOperationalInventoryDetail,
  resolveOperationalInventoryTarget,
  type OperationalInventoryDetail,
} from "@/lib/inventory/operational-inventory";
import { validateInventoryAdjustment } from "@/lib/inventory/inventory-rules";
import { createClient } from "@/lib/supabase/server";

const uuidSchema = z.uuid();

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function safeInventoryFailure(code?: string): InventoryActionResult {
  if (code === "23514") {
    return {
      status: "error",
      message:
        "El ajuste dejaría existencias disponibles negativas. Actualiza la página y revisa el saldo.",
    };
  }
  if (code === "P0002") {
    return {
      status: "error",
      message: "El ítem de inventario ya no está disponible.",
    };
  }
  if (code === "22023") {
    return {
      status: "error",
      message: "El producto o el movimiento ya no admite este ajuste.",
    };
  }
  return {
    status: "error",
    message: "No pudimos guardar el ajuste. Inténtalo nuevamente.",
  };
}

export async function initializeInventoryAction(
  _previousState: InventoryActionResult,
  formData: FormData,
): Promise<InventoryActionResult> {
  const productId = formString(formData, "productId");
  const variantId = formString(formData, "variantId");
  await requireCatalogManager(
    `/operacion/inventario/${productId}/${variantId}`,
  );

  const parsedProductId = uuidSchema.safeParse(productId);
  const parsedVariantId = uuidSchema.safeParse(variantId);
  if (!parsedProductId.success || !parsedVariantId.success) {
    return { status: "error", message: "El ítem de inventario no es válido." };
  }

  const target = await resolveOperationalInventoryTarget(
    parsedProductId.data,
    parsedVariantId.data,
  );
  if (target.error || !target.data) {
    return {
      status: "error",
      message:
        "El producto y la variante no están disponibles para inventario.",
    };
  }

  const client = await createClient();
  const { data, error } = await client.rpc("initialize_inventory", {
    requested_variant_id: target.data.variantId,
  });

  if (error || !data[0]) return safeInventoryFailure(error?.code);

  revalidatePath("/operacion/inventario");
  revalidatePath(
    `/operacion/inventario/${parsedProductId.data}/${parsedVariantId.data}`,
  );
  return {
    status: "success",
    message: data[0].initialized
      ? "El inventario se inicializó en cero."
      : "El inventario ya estaba inicializado.",
  };
}

export async function adjustInventoryAction(
  _previousState: InventoryActionResult,
  formData: FormData,
): Promise<InventoryActionResult> {
  const productId = formString(formData, "productId");
  const variantId = formString(formData, "variantId");
  await requireCatalogManager(
    `/operacion/inventario/${productId}/${variantId}`,
  );

  const parsedProductId = uuidSchema.safeParse(productId);
  const parsedVariantId = uuidSchema.safeParse(variantId);
  const quantity = Number(formString(formData, "quantityDelta"));
  const validated = validateInventoryAdjustment({
    movementType: formString(formData, "movementType"),
    quantityDelta: quantity,
    reason: formString(formData, "reason"),
    referenceType: formString(formData, "referenceType"),
    referenceId: formString(formData, "referenceId"),
    idempotencyKey: formString(formData, "idempotencyKey"),
  });

  if (
    !parsedProductId.success ||
    !parsedVariantId.success ||
    !validated.success
  ) {
    return {
      status: "error",
      message: "Revisa cantidad, tipo, motivo y referencia del ajuste.",
    };
  }

  const target = await resolveOperationalInventoryTarget(
    parsedProductId.data,
    parsedVariantId.data,
  );
  if (target.error || !target.data) {
    return {
      status: "error",
      message:
        "El producto y la variante no están disponibles para inventario.",
    };
  }

  const client = await createClient();
  const { data, error } = await client.rpc("adjust_inventory", {
    requested_variant_id: target.data.variantId,
    requested_movement_type: validated.data.movementType,
    requested_quantity_delta: validated.data.quantityDelta,
    requested_reason: validated.data.reason,
    requested_idempotency_key: validated.data.idempotencyKey,
    requested_reference_type: validated.data.referenceType || null,
    requested_reference_id: validated.data.referenceId || null,
  });

  if (error || !data[0]) return safeInventoryFailure(error?.code);

  revalidatePath("/operacion/inventario");
  revalidatePath(
    `/operacion/inventario/${parsedProductId.data}/${parsedVariantId.data}`,
  );
  revalidatePath("/productos");

  return {
    status: "success",
    message: data[0].replayed
      ? "Este ajuste ya se había registrado; no se duplicó."
      : "El movimiento se registró correctamente.",
    balance: {
      before: data[0].quantity_on_hand_before,
      after: data[0].quantity_on_hand_after,
      availableAfter: data[0].available_after,
    },
    nextIdempotencyKey: randomUUID(),
  };
}

export async function loadInventoryDetailAction(
  productId: string,
  variantId: string,
): Promise<OperationalInventoryDetail | null> {
  await requireCatalogManager(
    `/operacion/inventario/${productId}/${variantId}`,
  );
  const parsedProductId = uuidSchema.safeParse(productId);
  const parsedVariantId = uuidSchema.safeParse(variantId);
  if (!parsedProductId.success || !parsedVariantId.success) return null;

  const result = await getOperationalInventoryDetail(
    parsedProductId.data,
    parsedVariantId.data,
  );
  return result.error ? null : result.data;
}
