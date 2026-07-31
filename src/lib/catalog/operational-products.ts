import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  minorUnitsToPriceInput,
  type ProductFormValues,
} from "@/lib/catalog/product-validation";
import type { Database } from "@/types/database.types";

type ProductCondition = Database["public"]["Enums"]["product_condition"];
type ProductConditionGrade =
  Database["public"]["Enums"]["product_condition_grade"];
type ProductStatus = Database["public"]["Enums"]["product_status"];
type FulfillmentType = Database["public"]["Enums"]["fulfillment_type"];

export type CatalogReference = {
  id: string;
  name: string;
};

export type OperationalProductSummary = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  condition: ProductCondition;
  conditionGrade: ProductConditionGrade | null;
  fulfillmentType: FulfillmentType;
  price: number;
  currency: string;
  published: boolean;
  status: ProductStatus;
  archivedAt: string | null;
  brandName: string | null;
  categoryName: string | null;
};

export type OperationalProduct = OperationalProductSummary & {
  brandId: string;
  categoryId: string;
  shortDescription: string | null;
  description: string | null;
  conditionNotes: string | null;
  compareAtPrice: number | null;
  priceIsEstimate: boolean;
  leadTimeMinDays: number | null;
  leadTimeMaxDays: number | null;
  featured: boolean;
};

export type OperationalProductImage = {
  id: string;
  storagePath: string;
  altText: string;
  sortOrder: number;
  isPrimary: boolean;
  isConditionEvidence: boolean;
};

export type OperationalCatalogResult<T> =
  { data: T; error: null } | { data: null; error: "unavailable" };

const operationalProductListColumns = `
  id,
  slug,
  sku,
  name,
  condition,
  condition_grade,
  fulfillment_type,
  price,
  currency,
  published,
  status,
  archived_at,
  brand:brands!products_brand_id_fkey(name),
  category:categories!products_category_id_fkey(name)
`;

const operationalProductDetailColumns = `
  id,
  slug,
  sku,
  name,
  short_description,
  description,
  condition,
  condition_grade,
  condition_notes,
  brand_id,
  category_id,
  fulfillment_type,
  price,
  compare_at_price,
  currency,
  price_is_estimate,
  lead_time_min_days,
  lead_time_max_days,
  featured,
  published,
  status,
  archived_at,
  brand:brands!products_brand_id_fkey(name),
  category:categories!products_category_id_fkey(name)
`;

async function queryOperationalProducts() {
  const client = await createClient();

  return client
    .from("products")
    .select(operationalProductListColumns)
    .order("updated_at", { ascending: false })
    .limit(200);
}

async function queryOperationalProductById(id: string) {
  const client = await createClient();

  return client
    .from("products")
    .select(operationalProductDetailColumns)
    .eq("id", id)
    .maybeSingle();
}

async function queryOperationalProductImages(productId: string) {
  const client = await createClient();

  return client
    .from("product_images")
    .select(
      "id, storage_path, alt_text, sort_order, is_primary, is_condition_evidence",
    )
    .eq("product_id", productId)
    .order("sort_order")
    .order("id");
}

type OperationalProductListRow = NonNullable<
  Awaited<ReturnType<typeof queryOperationalProducts>>["data"]
>[number];

type OperationalProductDetailRow = NonNullable<
  Awaited<ReturnType<typeof queryOperationalProductById>>["data"]
>;

function normalizeSummary(
  product: OperationalProductListRow,
): OperationalProductSummary {
  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    name: product.name,
    condition: product.condition,
    conditionGrade: product.condition_grade,
    fulfillmentType: product.fulfillment_type,
    price: product.price,
    currency: product.currency,
    published: product.published,
    status: product.status,
    archivedAt: product.archived_at,
    brandName: product.brand?.name ?? null,
    categoryName: product.category?.name ?? null,
  };
}

function normalizeProduct(
  product: OperationalProductDetailRow,
): OperationalProduct {
  return {
    ...normalizeSummary(product),
    brandId: product.brand_id,
    categoryId: product.category_id,
    shortDescription: product.short_description,
    description: product.description,
    conditionNotes: product.condition_notes,
    compareAtPrice: product.compare_at_price,
    priceIsEstimate: product.price_is_estimate,
    leadTimeMinDays: product.lead_time_min_days,
    leadTimeMaxDays: product.lead_time_max_days,
    featured: product.featured,
  };
}

export async function listOperationalProducts(): Promise<
  OperationalCatalogResult<OperationalProductSummary[]>
> {
  try {
    const { data, error } = await queryOperationalProducts();

    if (error) {
      return { data: null, error: "unavailable" };
    }

    return { data: data.map(normalizeSummary), error: null };
  } catch {
    return { data: null, error: "unavailable" };
  }
}

export async function getOperationalProductById(
  id: string,
): Promise<OperationalCatalogResult<OperationalProduct | null>> {
  try {
    const { data, error } = await queryOperationalProductById(id);

    if (error) {
      return { data: null, error: "unavailable" };
    }

    return {
      data: data ? normalizeProduct(data) : null,
      error: null,
    };
  } catch {
    return { data: null, error: "unavailable" };
  }
}

export async function listOperationalProductImages(
  productId: string,
): Promise<OperationalCatalogResult<OperationalProductImage[]>> {
  try {
    const { data, error } = await queryOperationalProductImages(productId);
    if (error) {
      return { data: null, error: "unavailable" };
    }

    return {
      data: data.map((image) => ({
        id: image.id,
        storagePath: image.storage_path,
        altText: image.alt_text,
        sortOrder: image.sort_order,
        isPrimary: image.is_primary,
        isConditionEvidence: image.is_condition_evidence,
      })),
      error: null,
    };
  } catch {
    return { data: null, error: "unavailable" };
  }
}

export async function listActiveCatalogReferences(): Promise<
  OperationalCatalogResult<{
    brands: CatalogReference[];
    categories: CatalogReference[];
  }>
> {
  try {
    const client = await createClient();
    const [brandsResult, categoriesResult] = await Promise.all([
      client
        .from("brands")
        .select("id, name")
        .eq("status", "active")
        .order("name"),
      client
        .from("categories")
        .select("id, name")
        .eq("status", "active")
        .order("sort_order")
        .order("name"),
    ]);

    if (brandsResult.error || categoriesResult.error) {
      return { data: null, error: "unavailable" };
    }

    return {
      data: {
        brands: brandsResult.data,
        categories: categoriesResult.data,
      },
      error: null,
    };
  } catch {
    return { data: null, error: "unavailable" };
  }
}

export function productToFormValues(
  product: OperationalProduct,
): ProductFormValues {
  return {
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    brandId: product.brandId,
    categoryId: product.categoryId,
    shortDescription: product.shortDescription ?? "",
    description: product.description ?? "",
    condition: product.condition,
    conditionGrade: product.conditionGrade ?? "",
    conditionNotes: product.conditionNotes ?? "",
    fulfillmentType: product.fulfillmentType,
    price: minorUnitsToPriceInput(product.price),
    compareAtPrice: minorUnitsToPriceInput(product.compareAtPrice),
    currency: "MXN",
    priceIsEstimate: product.priceIsEstimate,
    leadTimeMinDays:
      product.leadTimeMinDays === null ? "" : String(product.leadTimeMinDays),
    leadTimeMaxDays:
      product.leadTimeMaxDays === null ? "" : String(product.leadTimeMaxDays),
    featured: product.featured,
    published: product.published,
  };
}

export const emptyProductFormValues: ProductFormValues = {
  name: "",
  slug: "",
  sku: "",
  brandId: "",
  categoryId: "",
  shortDescription: "",
  description: "",
  condition: "new",
  conditionGrade: "",
  conditionNotes: "",
  fulfillmentType: "in_stock",
  price: "",
  compareAtPrice: "",
  currency: "MXN",
  priceIsEstimate: false,
  leadTimeMinDays: "",
  leadTimeMaxDays: "",
  featured: false,
  published: false,
};
