import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type ProductCondition = Database["public"]["Enums"]["product_condition"];
type ProductConditionGrade =
  Database["public"]["Enums"]["product_condition_grade"];
type FulfillmentType = Database["public"]["Enums"]["fulfillment_type"];

export type PublicProductImage = {
  id: string;
  storagePath: string;
  altText: string;
  isPrimary: boolean;
  sortOrder: number;
};

export type PublicProductVariant = {
  id: string;
  name: string;
  sku: string;
  price: number | null;
  compareAtPrice: number | null;
};

export type PublicProductSummary = {
  id: string;
  slug: string;
  name: string;
  condition: ProductCondition;
  conditionGrade: ProductConditionGrade | null;
  fulfillmentType: FulfillmentType;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  priceIsEstimate: boolean;
  leadTimeMinDays: number | null;
  leadTimeMaxDays: number | null;
  brandName: string | null;
  categoryName: string | null;
  images: PublicProductImage[];
};

export type PublicProduct = PublicProductSummary & {
  shortDescription: string | null;
  description: string | null;
  conditionNotes: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  variants: PublicProductVariant[];
};

export type PublicCatalogResult<T> =
  { data: T; error: null } | { data: null; error: "unavailable" };

const publicProductListColumns = `
  id,
  slug,
  name,
  condition,
  condition_grade,
  fulfillment_type,
  price,
  compare_at_price,
  currency,
  price_is_estimate,
  lead_time_min_days,
  lead_time_max_days,
  brand:brands!products_brand_id_fkey(name),
  category:categories!products_category_id_fkey(name),
  images:product_images(id, storage_path, alt_text, is_primary, sort_order)
`;

const publicProductDetailColumns = `
  id,
  slug,
  name,
  short_description,
  description,
  condition,
  condition_grade,
  condition_notes,
  fulfillment_type,
  price,
  compare_at_price,
  currency,
  price_is_estimate,
  lead_time_min_days,
  lead_time_max_days,
  seo_title,
  seo_description,
  brand:brands!products_brand_id_fkey(name),
  category:categories!products_category_id_fkey(name),
  images:product_images(id, storage_path, alt_text, is_primary, sort_order),
  variants:product_variants(id, name, sku, price, compare_at_price)
`;

type PublicProductListQueryRow = NonNullable<
  Awaited<ReturnType<typeof queryPublicProducts>>["data"]
>[number];

function normalizeProductImages(
  images: PublicProductListQueryRow["images"],
): PublicProductImage[] {
  return (images ?? [])
    .map((image) => ({
      id: image.id,
      storagePath: image.storage_path,
      altText: image.alt_text,
      isPrimary: image.is_primary,
      sortOrder: image.sort_order,
    }))
    .sort(
      (left, right) =>
        Number(right.isPrimary) - Number(left.isPrimary) ||
        left.sortOrder - right.sortOrder,
    );
}

function normalizeProductSummary(
  product: PublicProductListQueryRow,
): PublicProductSummary {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    condition: product.condition,
    conditionGrade: product.condition_grade,
    fulfillmentType: product.fulfillment_type,
    price: product.price,
    compareAtPrice: product.compare_at_price,
    currency: product.currency,
    priceIsEstimate: product.price_is_estimate,
    leadTimeMinDays: product.lead_time_min_days,
    leadTimeMaxDays: product.lead_time_max_days,
    brandName: product.brand?.name ?? null,
    categoryName: product.category?.name ?? null,
    images: normalizeProductImages(product.images),
  };
}

type PublicProductDetailQueryRow = NonNullable<
  Awaited<ReturnType<typeof queryPublicProductBySlug>>["data"]
>;

function normalizeProductDetail(
  product: PublicProductDetailQueryRow,
): PublicProduct {
  return {
    ...normalizeProductSummary(product),
    shortDescription: product.short_description,
    description: product.description,
    conditionNotes: product.condition_notes,
    seoTitle: product.seo_title,
    seoDescription: product.seo_description,
    variants: (product.variants ?? [])
      .map((variant) => ({
        id: variant.id,
        name: variant.name,
        sku: variant.sku,
        price: variant.price,
        compareAtPrice: variant.compare_at_price,
      }))
      .sort((left, right) => left.name.localeCompare(right.name, "es-MX")),
  };
}

async function queryPublicProducts() {
  const client = await createClient();

  return client
    .from("products")
    .select(publicProductListColumns)
    .eq("status", "active")
    .eq("published", true)
    .is("archived_at", null)
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(48);
}

async function queryPublicProductBySlug(slug: string) {
  const client = await createClient();

  return client
    .from("products")
    .select(publicProductDetailColumns)
    .eq("slug", slug)
    .eq("status", "active")
    .eq("published", true)
    .is("archived_at", null)
    .maybeSingle();
}

export async function listPublicProducts(): Promise<
  PublicCatalogResult<PublicProductSummary[]>
> {
  try {
    const { data, error } = await queryPublicProducts();

    if (error) {
      return { data: null, error: "unavailable" };
    }

    return { data: data.map(normalizeProductSummary), error: null };
  } catch {
    return { data: null, error: "unavailable" };
  }
}

export const getPublicProductBySlug = cache(
  async (slug: string): Promise<PublicCatalogResult<PublicProduct | null>> => {
    try {
      const { data, error } = await queryPublicProductBySlug(slug);

      if (error) {
        return { data: null, error: "unavailable" };
      }

      return { data: data ? normalizeProductDetail(data) : null, error: null };
    } catch {
      return { data: null, error: "unavailable" };
    }
  },
);
