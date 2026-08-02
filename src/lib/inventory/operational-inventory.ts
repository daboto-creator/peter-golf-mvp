import "server-only";

import {
  getInventoryLevel,
  isOperationalInventoryVariant,
  normalizeInventorySearchTerm,
  resolveInventoryMutationTarget,
  transformInventoryHistory,
  type InventoryLevel,
} from "@/lib/inventory/inventory-rules";
import { createClient } from "@/lib/supabase/server";
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
  variantId: string;
  variantName: string;
  variantSku: string;
  inventoryId: string | null;
  quantityOnHand: number | null;
  quantityReserved: number | null;
  available: number | null;
  reorderPoint: number | null;
  level: InventoryLevel;
  updatedAt: string;
  manageable: boolean;
  managementMessage: string | null;
};

export type OperationalInventoryMovement = ReturnType<
  typeof transformInventoryHistory
>[number];

export type OperationalInventoryDetail = OperationalInventorySummary & {
  movements: OperationalInventoryMovement[];
};

export type OperationalInventoryProductOverview = {
  productId: string;
  productName: string;
  productSku: string;
  status: ProductStatus;
  published: boolean;
  archivedAt: string | null;
  canRepairBaseVariant: boolean;
  variants: OperationalInventorySummary[];
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
    name,
    sku,
    active,
    archived_at,
    updated_at,
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

async function queryInventoryProducts(
  filters: InventoryListFilters = {},
  search?: string,
) {
  const client = await createClient();
  let query = client
    .from("products")
    .select(inventoryProductColumns)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.condition) query = query.eq("condition", filters.condition);
  if (search) query = query.or(`name.ilike.*${search}*,sku.ilike.*${search}*`);
  return query;
}

async function queryInventoryVariants(
  filters: InventoryListFilters = {},
  search?: string,
) {
  const client = await createClient();
  let query = client
    .from("product_variants")
    .select(
      `
        id,
        name,
        sku,
        active,
        archived_at,
        updated_at,
        inventory (
          id,
          quantity_on_hand,
          quantity_reserved,
          reorder_point,
          updated_at
        ),
        product:products!inner (
          id,
          name,
          sku,
          condition,
          status,
          published,
          archived_at,
          updated_at
        )
      `,
    )
    .eq("active", true)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (filters.status) query = query.eq("product.status", filters.status);
  if (filters.condition)
    query = query.eq("product.condition", filters.condition);
  if (search) query = query.or(`name.ilike.*${search}*,sku.ilike.*${search}*`);
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
type InventoryVariantRow = NonNullable<
  Awaited<ReturnType<typeof queryInventoryVariants>>["data"]
>[number];
type EmbeddedVariant = InventoryProductRow["variants"][number];

function normalizeInventoryVariant({
  product,
  variant,
}: {
  product: Pick<
    InventoryProductRow,
    | "id"
    | "name"
    | "sku"
    | "condition"
    | "status"
    | "published"
    | "archived_at"
    | "updated_at"
  >;
  variant: Pick<
    EmbeddedVariant,
    | "id"
    | "name"
    | "sku"
    | "active"
    | "archived_at"
    | "updated_at"
    | "inventory"
  >;
}): OperationalInventorySummary {
  const inventory = variant.inventory;
  const archived =
    product.status === "archived" || product.archived_at !== null;
  return {
    productId: product.id,
    productName: product.name,
    productSku: product.sku,
    condition: product.condition,
    status: product.status,
    published: product.published,
    archivedAt: product.archived_at,
    variantId: variant.id,
    variantName: variant.name,
    variantSku: variant.sku,
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
    updatedAt:
      inventory?.updated_at ?? variant.updated_at ?? product.updated_at,
    manageable: !archived && variant.active && variant.archived_at === null,
    managementMessage: archived
      ? "El producto archivado conserva su historial y no admite ajustes."
      : !variant.active || variant.archived_at !== null
        ? "La variante no está operativa y no admite ajustes."
        : null,
  };
}

function normalizeProductVariants(product: InventoryProductRow) {
  return product.variants
    .filter((variant) =>
      isOperationalInventoryVariant({
        active: variant.active,
        archivedAt: variant.archived_at,
      }),
    )
    .map((variant) => normalizeInventoryVariant({ product, variant }));
}

function normalizeRootVariant(row: InventoryVariantRow) {
  return normalizeInventoryVariant({
    product: row.product,
    variant: row,
  });
}

export async function listOperationalInventory(
  filters: InventoryListFilters = {},
): Promise<InventoryResult<OperationalInventorySummary[]>> {
  try {
    const search = normalizeInventorySearchTerm(filters.query);
    const variantResult = await queryInventoryVariants(
      filters,
      search ?? undefined,
    );
    if (variantResult.error) return { data: null, error: "unavailable" };

    const matches = variantResult.data.map(normalizeRootVariant);
    if (search) {
      const productResult = await queryInventoryProducts(filters, search);
      if (productResult.error) return { data: null, error: "unavailable" };
      matches.push(...productResult.data.flatMap(normalizeProductVariants));
    }

    const unique = new Map(
      matches.map((item) => [`${item.productId}:${item.variantId}`, item]),
    );
    return {
      data: [...unique.values()]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, 200),
      error: null,
    };
  } catch {
    return { data: null, error: "unavailable" };
  }
}

export async function getOperationalInventoryProductOverview(
  productId: string,
): Promise<InventoryResult<OperationalInventoryProductOverview | null>> {
  try {
    const result = await queryInventoryProduct(productId);
    if (result.error) return { data: null, error: "unavailable" };
    if (!result.data) return { data: null, error: null };
    return {
      data: {
        productId: result.data.id,
        productName: result.data.name,
        productSku: result.data.sku,
        status: result.data.status,
        published: result.data.published,
        archivedAt: result.data.archived_at,
        canRepairBaseVariant:
          result.data.status !== "archived" &&
          result.data.archived_at === null &&
          result.data.variants.length === 0,
        variants: normalizeProductVariants(result.data),
      },
      error: null,
    };
  } catch {
    return { data: null, error: "unavailable" };
  }
}

export async function getOperationalInventoryDetail(
  productId: string,
  variantId: string,
): Promise<InventoryResult<OperationalInventoryDetail | null>> {
  try {
    const productResult = await queryInventoryProduct(productId);
    if (productResult.error) return { data: null, error: "unavailable" };
    if (!productResult.data) return { data: null, error: null };

    const summary = normalizeProductVariants(productResult.data).find(
      (item) => item.variantId === variantId,
    );
    if (!summary) return { data: null, error: null };
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
      data: { ...summary, movements: transformInventoryHistory(history.data) },
      error: null,
    };
  } catch {
    return { data: null, error: "unavailable" };
  }
}
