import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type CatalogRecordStatus = Database["public"]["Enums"]["catalog_record_status"];

export type OperationalBrand = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: CatalogRecordStatus;
  productCount: number;
};

export type OperationalCategory = OperationalBrand & {
  parentId: string | null;
  parentName: string | null;
  sortOrder: number;
  childCount: number;
  displayName: string;
};

export type TaxonomyResult<T> =
  { data: T; error: null } | { data: null; error: "unavailable" };

const brandColumns =
  "id, name, slug, description, status, products(count)" as const;
const categoryColumns =
  "id, parent_id, name, slug, description, status, sort_order, products(count)" as const;

function productCount(products: { count: number }[]): number {
  return products[0]?.count ?? 0;
}

function normalizeBrand(row: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: CatalogRecordStatus;
  products: { count: number }[];
}): OperationalBrand {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    status: row.status,
    productCount: productCount(row.products),
  };
}

function normalizeCategories(
  rows: Array<{
    id: string;
    parent_id: string | null;
    name: string;
    slug: string;
    description: string | null;
    status: CatalogRecordStatus;
    sort_order: number;
    products: { count: number }[];
  }>,
): OperationalCategory[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const childrenByParent = new Map<string, number>();
  for (const row of rows) {
    if (row.parent_id) {
      childrenByParent.set(
        row.parent_id,
        (childrenByParent.get(row.parent_id) ?? 0) + 1,
      );
    }
  }

  function displayName(row: (typeof rows)[number]): string {
    const names = [row.name];
    const visited = new Set([row.id]);
    let parentId = row.parent_id;
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) break;
      names.unshift(parent.name);
      parentId = parent.parent_id;
    }
    return names.join(" › ");
  }

  return rows.map((row) => ({
    ...normalizeBrand(row),
    parentId: row.parent_id,
    parentName: row.parent_id ? (byId.get(row.parent_id)?.name ?? null) : null,
    sortOrder: row.sort_order,
    childCount: childrenByParent.get(row.id) ?? 0,
    displayName: displayName(row),
  }));
}

export async function listOperationalBrands(): Promise<
  TaxonomyResult<OperationalBrand[]>
> {
  try {
    const client = await createClient();
    const { data, error } = await client
      .from("brands")
      .select(brandColumns)
      .order("name");
    if (error) return { data: null, error: "unavailable" };
    return { data: data.map(normalizeBrand), error: null };
  } catch {
    return { data: null, error: "unavailable" };
  }
}

export async function getOperationalBrand(
  id: string,
): Promise<TaxonomyResult<OperationalBrand | null>> {
  try {
    const client = await createClient();
    const { data, error } = await client
      .from("brands")
      .select(brandColumns)
      .eq("id", id)
      .maybeSingle();
    if (error) return { data: null, error: "unavailable" };
    return { data: data ? normalizeBrand(data) : null, error: null };
  } catch {
    return { data: null, error: "unavailable" };
  }
}

export async function listOperationalCategories(): Promise<
  TaxonomyResult<OperationalCategory[]>
> {
  try {
    const client = await createClient();
    const { data, error } = await client
      .from("categories")
      .select(categoryColumns)
      .order("sort_order")
      .order("name");
    if (error) return { data: null, error: "unavailable" };
    return { data: normalizeCategories(data), error: null };
  } catch {
    return { data: null, error: "unavailable" };
  }
}

export async function getOperationalCategory(
  id: string,
): Promise<TaxonomyResult<OperationalCategory | null>> {
  const result = await listOperationalCategories();
  if (result.error) return result;
  return {
    data: result.data.find((category) => category.id === id) ?? null,
    error: null,
  };
}
