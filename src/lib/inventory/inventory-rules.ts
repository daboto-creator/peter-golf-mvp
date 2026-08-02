import { z } from "zod";

export const inventoryMovementTypes = ["receipt", "adjustment"] as const;
export type OperationalInventoryMovementType =
  (typeof inventoryMovementTypes)[number];

export type InventoryLevel =
  "uninitialized" | "out_of_stock" | "low_stock" | "in_stock";

export type InventoryMutationTargetProduct = {
  id: string;
  status: "draft" | "active" | "archived";
  archivedAt: string | null;
  variants: {
    id: string;
    active: boolean;
    archivedAt: string | null;
  }[];
};

export type InventoryMutationTargetResolution =
  | { success: true; variantId: string }
  | {
      success: false;
      reason:
        "product_unavailable" | "variant_mismatch" | "product_not_manageable";
    };

export function isOperationalInventoryVariant(variant: {
  active: boolean;
  archivedAt: string | null;
}): boolean {
  return variant.active && variant.archivedAt === null;
}

export function resolveInventoryMutationTarget(
  requestedProductId: string,
  requestedVariantId: string,
  product: InventoryMutationTargetProduct | null,
): InventoryMutationTargetResolution {
  if (!product || product.id !== requestedProductId) {
    return { success: false, reason: "product_unavailable" };
  }

  if (product.status === "archived" || product.archivedAt !== null) {
    return { success: false, reason: "product_not_manageable" };
  }

  const variant = product.variants.find(
    (candidate) => candidate.id === requestedVariantId,
  );
  if (!variant || !isOperationalInventoryVariant(variant)) {
    return { success: false, reason: "variant_mismatch" };
  }

  return { success: true, variantId: variant.id };
}

export function normalizeInventorySearchTerm(value?: string): string | null {
  const normalized = value
    ?.trim()
    .replace(/[^\p{L}\p{N}\s._-]/gu, "")
    .slice(0, 100);
  return normalized || null;
}

const adjustmentSchema = z
  .object({
    movementType: z.enum(inventoryMovementTypes),
    quantityDelta: z.number().int().min(-1_000_000).max(1_000_000),
    reason: z.string().trim().min(3).max(500),
    referenceType: z.string().trim().max(80),
    referenceId: z.union([z.literal(""), z.uuid()]),
    idempotencyKey: z.uuid(),
  })
  .superRefine((value, context) => {
    if (value.quantityDelta === 0) {
      context.addIssue({
        code: "custom",
        path: ["quantityDelta"],
        message: "La cantidad no puede ser cero.",
      });
    }
    if (value.movementType === "receipt" && value.quantityDelta < 0) {
      context.addIssue({
        code: "custom",
        path: ["quantityDelta"],
        message: "Una recepción sólo puede incrementar existencias.",
      });
    }
    if ((value.referenceType === "") !== (value.referenceId === "")) {
      context.addIssue({
        code: "custom",
        path: ["referenceType"],
        message: "La referencia requiere tipo e identificador.",
      });
    }
  });

export type InventoryAdjustmentInput = z.infer<typeof adjustmentSchema>;

export function validateInventoryAdjustment(input: unknown) {
  return adjustmentSchema.safeParse(input);
}

export function calculateInventoryBalance(
  quantityOnHand: number,
  quantityReserved: number,
  quantityDelta: number,
): { quantityOnHandAfter: number; availableAfter: number } | null {
  if (
    !Number.isInteger(quantityOnHand) ||
    !Number.isInteger(quantityReserved) ||
    !Number.isInteger(quantityDelta)
  ) {
    return null;
  }

  const quantityOnHandAfter = quantityOnHand + quantityDelta;
  if (quantityOnHandAfter < 0 || quantityOnHandAfter < quantityReserved) {
    return null;
  }

  return {
    quantityOnHandAfter,
    availableAfter: quantityOnHandAfter - quantityReserved,
  };
}

export function getInventoryLevel(
  quantityOnHand: number | null,
  quantityReserved: number | null,
  reorderPoint: number | null,
): InventoryLevel {
  if (
    quantityOnHand === null ||
    quantityReserved === null ||
    reorderPoint === null
  ) {
    return "uninitialized";
  }

  const available = quantityOnHand - quantityReserved;
  if (available <= 0) return "out_of_stock";
  if (reorderPoint > 0 && available <= reorderPoint) return "low_stock";
  return "in_stock";
}

export function getInventoryLevelLabel(level: InventoryLevel): string {
  return {
    uninitialized: "Sin inicializar",
    out_of_stock: "Agotado",
    low_stock: "Stock bajo",
    in_stock: "En stock",
  }[level];
}

export type InventoryHistoryRow = {
  id: string;
  movement_type: string;
  quantity_delta: number;
  quantity_on_hand_after: number;
  quantity_reserved_after: number;
  reason: string;
  reference_type: string | null;
  reference_id: string | null;
  actor_id: string | null;
  created_at: string;
};

export function transformInventoryHistory(rows: InventoryHistoryRow[]) {
  return [...rows]
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .map((row) => ({
      id: row.id,
      movementType: row.movement_type,
      quantityDelta: row.quantity_delta,
      quantityOnHandAfter: row.quantity_on_hand_after,
      quantityReservedAfter: row.quantity_reserved_after,
      reason: row.reason,
      reference:
        row.reference_type && row.reference_id
          ? `${row.reference_type}: ${row.reference_id}`
          : null,
      actorId: row.actor_id,
      createdAt: row.created_at,
    }));
}
