import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  getInventoryLevel,
  resolveInventoryMutationTarget,
  transformInventoryHistory,
  type InventoryLevel,
} from "@/lib/inventory/inventory-rules";
import type { Database } from "@/types/database.types";

type ProductCondition = Database["public"]["Enums"]["product_condition"];
type ProductStatus = Database["public"]["Enums"]["product_status"];

export type OperationalInventorySummary = {
  productId: string;
  productName: string;
  productSku: string;
  condition: ProductCondition;
  status: ProductStatus;
  published: boolean;
  archivedAt: string | null;
  variantId: string | null;
  variantSku: string | null;
  inventoryId: string | null;
  quantityOnHand: number | null;
  quantityReserved: number | null;
  available: number | null;
  reorderPoint: number | null;
  level: InventoryLevel;
  updatedAt: string;
  manageable: boolean;
  canRepairBaseVariant: boolean;
  managementMessage: string | null;
};

export type OperationalInventoryMovement = ReturnType<
  typeof transformInventoryHistory
>[number];

export type OperationalInventoryDetail = OperationalInventorySummary & {
  movements: OperationalInventoryMovement[];
};

export type InventoryResult<T> =
  { data: T; error: null } | { data: null; error: "unavailable" };

const inventoryProductColumns = `
  id,
  name,
  sku,
  condition,
  status,
  published,
  archived_at,
  updated_at,
  variants:product_variants (
    id,
    sku,
    active,
    archived_at,
    inventory (
      id,
      quantity_on_hand,
      quantity_reserved,
      reorder_point,
      updated_at
    )
  )
`;

const inventoryMutationTargetColumns = `
  id,
  status,
  archived_at,
  variants:product_variants (
    id,
    active,
    archived_at
  )
`;

type InventoryListFilters = {
  query?: string;
  status?: ProductStatus;
  condition?: ProductCondition;
};

async function queryInventoryProducts(filters: InventoryListFilters = {}) {
  const client = await createClient();
  let query = client
    .from("products")
    .select(inventoryProductColumns)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.condition) query = query.eq("condition", filters.condition);

  const safeSearch = filters.query
    ?.trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .slice(0, 100);
  if (safeSearch) {
    query = query.or(`name.ilike.*${safeSearch}*,sku.ilike.*${safeSearch}*`);
  }

  return query;
}

async function queryInventoryProduct(productId: string) {
  const client = await createClient();
  return client
    .from("products")
    .select(inventoryProductColumns)
    .eq("id", productId)
    .maybeSingle();
}

async function queryInventoryMutationTarget(productId: string) {
  const client = await createClient();
  return client
    .from("products")
    .select(inventoryMutationTargetColumns)
    .eq("id", productId)
    .maybeSingle();
}

export async function resolveOperationalInventoryTarget(
  productId: string,
  variantId: string,
): Promise<InventoryResult<{ variantId: string } | null>> {
  try {
    const { data, error } = await queryInventoryMutationTarget(productId);
    if (error) return { data: null, error: "unavailable" };

    const resolution = resolveInventoryMutationTarget(
      productId,
      variantId,
      data
        ? {
            id: data.id,
            status: data.status,
            archivedAt: data.archived_at,
            variants: data.variants.map((variant) => ({
              id: variant.id,
              active: variant.active,
              archivedAt: variant.archived_at,
            })),
          }
        : null,
    );

    return {
      data: resolution.success ? { variantId: resolution.variantId } : null,
      error: null,
    };
  } catch {
    return { data: null, error: "unavailable" };
  }
}

type InventoryProductRow = NonNullable<
  Awaited<ReturnType<typeof queryInventoryProducts>>["data"]
>[number];

function normalizeInventoryProduct(
  product: InventoryProductRow,
): OperationalInventorySummary {
  const operationalVariants = product.variants.filter(
    (variant) => variant.active && variant.archived_at === null,
  );
  const variant =
    operationalVariants.length === 1 ? operationalVariants[0] : null;
  const inventory = variant?.inventory ?? null;
  const archived =
    product.status === "archived" || product.archived_at !== null;
  const manageable = !archived && variant !== null;

  return {
    productId: product.id,
    productName: product.name,
    productSku: product.sku,
    condition: product.condition,
    status: product.status,
    published: product.published,
    archivedAt: product.archived_at,
    variantId: variant?.id ?? null,
    variantSku: variant?.sku ?? null,
    inventoryId: inventory?.id ?? null,
    quantityOnHand: inventory?.quantity_on_hand ?? null,
    quantityReserved: inventory?.quantity_reserved ?? null,
    available:
      inventory === null
        ? null
        : inventory.quantity_on_hand - inventory.quantity_reserved,
    reorderPoint: inventory?.reorder_point ?? null,
    level: getInventoryLevel(
      inventory?.quantity_on_hand ?? null,
      inventory?.quantity_reserved ?? null,
      inventory?.reorder_point ?? null,
    ),
    updatedAt: inventory?.updated_at ?? product.updated_at,
    manageable,
    canRepairBaseVariant: !archived && product.variants.length === 0,
    managementMessage: archived
      ? "El producto archivado conserva su historial y no admite ajustes."
      : operationalVariants.length === 0
        ? "Este producto aún no tiene una variante operativa."
        : operationalVariants.length > 1
          ? "Este producto requiere gestión de variantes antes de ajustar inventario."
          : null,
  };
}

export async function listOperationalInventory(
  filters: InventoryListFilters = {},
): Promise<InventoryResult<OperationalInventorySummary[]>> {
  try {
    const { data, error } = await queryInventoryProducts(filters);
    if (error) return { data: null, error: "unavailable" };
    return { data: data.map(normalizeInventoryProduct), error: null };
  } catch {
    return { data: null, error: "unavailable" };
  }
}

export async function getOperationalInventoryDetail(
  productId: string,
): Promise<InventoryResult<OperationalInventoryDetail | null>> {
  try {
    const productResult = await queryInventoryProduct(productId);
    if (productResult.error) return { data: null, error: "unavailable" };
    if (!productResult.data) return { data: null, error: null };

    const summary = normalizeInventoryProduct(productResult.data);
    if (!summary.inventoryId) {
      return { data: { ...summary, movements: [] }, error: null };
    }

    const client = await createClient();
    const history = await client
      .from("inventory_movements")
      .select(
        "id, movement_type, quantity_delta, quantity_on_hand_after, quantity_reserved_after, reason, reference_type, reference_id, actor_id, created_at",
      )
      .eq("inventory_id", summary.inventoryId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (history.error) return { data: null, error: "unavailable" };

    return {
      data: {
        ...summary,
        movements: transformInventoryHistory(history.data),
      },
      error: null,
    };
  } catch {
    return { data: null, error: "unavailable" };
  }
}
