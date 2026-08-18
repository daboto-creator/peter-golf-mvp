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
  conditionScore: number | null;
  fulfillmentType: FulfillmentType;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  priceIsEstimate: boolean;
  leadTimeMinDays: number | null;
  leadTimeMaxDays: number | null;
  brandName: string | null;
  brandId: string | null;
  categoryName: string | null;
  categoryId: string | null;
  productFamily: Database["public"]["Enums"]["golf_product_family"] | null;
  clubType: Database["public"]["Enums"]["golf_club_type"] | null;
  bagType: Database["public"]["Enums"]["golf_bag_type"] | null;
  setType: Database["public"]["Enums"]["golf_set_type"] | null;
  handedness: Database["public"]["Enums"]["golfer_handedness"] | null;
  shaftFlex: Database["public"]["Enums"]["golf_shaft_flex"] | null;
  shaftMaterial: Database["public"]["Enums"]["golf_shaft_material"] | null;
  loftDegrees: number | null;
  color: string | null;
  componentClubTypes: Database["public"]["Enums"]["golf_club_type"][];
  componentBagTypes: Database["public"]["Enums"]["golf_bag_type"][];
  images: PublicProductImage[];
};

export type PublicProduct = PublicProductSummary & {
  shortDescription: string | null;
  description: string | null;
  conditionNotes: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  clubSpecs: Database["public"]["Tables"]["product_club_specs"]["Row"] | null;
  bagSpecs: Database["public"]["Tables"]["product_bag_specs"]["Row"] | null;
  setSpecs: Database["public"]["Tables"]["product_set_specs"]["Row"] | null;
  components: Database["public"]["Tables"]["product_components"]["Row"][];
  variants: PublicProductVariant[];
};

export type PublicCatalogResult<T> =
  { data: T; error: null } | { data: null; error: "unavailable" };

const publicProductBaseColumns = `
  id,
  slug,
  name,
  condition,
  condition_grade,
  condition_score,
  fulfillment_type,
  price,
  compare_at_price,
  currency,
  price_is_estimate,
  lead_time_min_days,
  lead_time_max_days,
  brand:brands!products_brand_id_fkey(id, name),
  category:categories!products_category_id_fkey(
    id,
    name,
    profile:category_spec_profiles(family)
  ),
  images:product_images(id, storage_path, alt_text, is_primary, sort_order)
`;

const publicProductListColumns = `
  ${publicProductBaseColumns},
  club_specs:product_club_specs(club_type, handedness, shaft_flex, shaft_material, loft_degrees),
  bag_specs:product_bag_specs(bag_type, color),
  set_specs:product_set_specs(set_type, handedness, shaft_flex, shaft_material),
  components:product_components(club_type, bag_type)
`;

const publicProductDetailColumns = `
  ${publicProductBaseColumns},
  club_specs:product_club_specs(*),
  bag_specs:product_bag_specs(*),
  set_specs:product_set_specs(*),
  components:product_components(*),
  short_description,
  description,
  condition_notes,
  seo_title,
  seo_description,
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
    conditionScore: product.condition_score,
    fulfillmentType: product.fulfillment_type,
    price: product.price,
    compareAtPrice: product.compare_at_price,
    currency: product.currency,
    priceIsEstimate: product.price_is_estimate,
    leadTimeMinDays: product.lead_time_min_days,
    leadTimeMaxDays: product.lead_time_max_days,
    brandName: product.brand?.name ?? null,
    brandId: product.brand?.id ?? null,
    categoryName: product.category?.name ?? null,
    categoryId: product.category?.id ?? null,
    productFamily: product.category?.profile?.family ?? null,
    clubType: product.club_specs?.club_type ?? null,
    bagType: product.bag_specs?.bag_type ?? null,
    setType: product.set_specs?.set_type ?? null,
    handedness:
      product.club_specs?.handedness ?? product.set_specs?.handedness ?? null,
    shaftFlex:
      product.club_specs?.shaft_flex ?? product.set_specs?.shaft_flex ?? null,
    shaftMaterial:
      product.club_specs?.shaft_material ??
      product.set_specs?.shaft_material ??
      null,
    loftDegrees: product.club_specs?.loft_degrees ?? null,
    color: product.bag_specs?.color ?? null,
    componentClubTypes: (product.components ?? [])
      .map((component) => component.club_type)
      .filter((value): value is NonNullable<typeof value> => value !== null),
    componentBagTypes: (product.components ?? [])
      .map((component) => component.bag_type)
      .filter((value): value is NonNullable<typeof value> => value !== null),
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
    clubSpecs: product.club_specs ?? null,
    bagSpecs: product.bag_specs ?? null,
    setSpecs: product.set_specs ?? null,
    components: (product.components ?? []).sort(
      (left, right) => left.sort_order - right.sort_order,
    ),
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
    .limit(200);
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

export type PublicProductFilters = {
  categoryId?: string;
  brandId?: string;
  minimumPrice?: number;
  maximumPrice?: number;
  condition?: "new" | ProductConditionGrade;
  available?: boolean;
  family?: Database["public"]["Enums"]["golf_product_family"];
  clubType?: Database["public"]["Enums"]["golf_club_type"];
  bagType?: Database["public"]["Enums"]["golf_bag_type"];
  setType?: Database["public"]["Enums"]["golf_set_type"];
  handedness?: Database["public"]["Enums"]["golfer_handedness"];
  shaftFlex?: Database["public"]["Enums"]["golf_shaft_flex"];
  shaftMaterial?: Database["public"]["Enums"]["golf_shaft_material"];
  loftDegrees?: number;
  color?: string;
  includesDriver?: boolean;
  includesFairwayWood?: boolean;
  includesHybrid?: boolean;
  includesPutter?: boolean;
  includesBag?: boolean;
};

export type PublicCatalogFacets = {
  brands: { id: string; name: string }[];
  categories: {
    id: string;
    name: string;
    family: PublicProductSummary["productFamily"];
  }[];
  colors: string[];
};

function filterProducts(
  products: PublicProductSummary[],
  filters: PublicProductFilters,
): PublicProductSummary[] {
  const includes = (items: string[], value: string) => items.includes(value);
  return products.filter(
    (product) =>
      (!filters.categoryId || product.categoryId === filters.categoryId) &&
      (!filters.brandId || product.brandId === filters.brandId) &&
      (filters.minimumPrice === undefined ||
        product.price >= filters.minimumPrice) &&
      (filters.maximumPrice === undefined ||
        product.price <= filters.maximumPrice) &&
      (!filters.condition ||
        (filters.condition === "new"
          ? product.condition === "new"
          : product.condition === "used" &&
            product.conditionGrade === filters.condition)) &&
      (!filters.available || product.fulfillmentType === "in_stock") &&
      (!filters.family || product.productFamily === filters.family) &&
      (!filters.clubType || product.clubType === filters.clubType) &&
      (!filters.bagType || product.bagType === filters.bagType) &&
      (!filters.setType || product.setType === filters.setType) &&
      (!filters.handedness || product.handedness === filters.handedness) &&
      (!filters.shaftFlex || product.shaftFlex === filters.shaftFlex) &&
      (!filters.shaftMaterial ||
        product.shaftMaterial === filters.shaftMaterial) &&
      (filters.loftDegrees === undefined ||
        product.loftDegrees === filters.loftDegrees) &&
      (!filters.color ||
        product.color?.toLocaleLowerCase("es-MX") ===
          filters.color.toLocaleLowerCase("es-MX")) &&
      (!filters.includesDriver ||
        includes(product.componentClubTypes, "driver")) &&
      (!filters.includesFairwayWood ||
        includes(product.componentClubTypes, "fairway_wood")) &&
      (!filters.includesHybrid ||
        includes(product.componentClubTypes, "hybrid")) &&
      (!filters.includesPutter ||
        includes(product.componentClubTypes, "putter")) &&
      (!filters.includesBag || product.componentBagTypes.length > 0),
  );
}

function catalogFacets(products: PublicProductSummary[]): PublicCatalogFacets {
  const brands = new Map<string, string>();
  const categories = new Map<
    string,
    PublicCatalogFacets["categories"][number]
  >();
  const colors = new Set<string>();
  for (const product of products) {
    if (product.brandId && product.brandName)
      brands.set(product.brandId, product.brandName);
    if (product.categoryId && product.categoryName)
      categories.set(product.categoryId, {
        id: product.categoryId,
        name: product.categoryName,
        family: product.productFamily,
      });
    if (product.color) colors.add(product.color);
  }
  return {
    brands: [...brands]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "es-MX")),
    categories: [...categories.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "es-MX"),
    ),
    colors: [...colors].sort((a, b) => a.localeCompare(b, "es-MX")),
  };
}

export async function listPublicProducts(
  filters: PublicProductFilters = {},
): Promise<PublicCatalogResult<PublicProductSummary[]>> {
  try {
    const { data, error } = await queryPublicProducts();

    if (error) {
      return { data: null, error: "unavailable" };
    }

    return {
      data: filterProducts(data.map(normalizeProductSummary), filters).slice(
        0,
        48,
      ),
      error: null,
    };
  } catch {
    return { data: null, error: "unavailable" };
  }
}

export async function getPublicCatalogFacets(): Promise<
  PublicCatalogResult<PublicCatalogFacets>
> {
  try {
    const { data, error } = await queryPublicProducts();
    return error
      ? { data: null, error: "unavailable" }
      : { data: catalogFacets(data.map(normalizeProductSummary)), error: null };
  } catch {
    return { data: null, error: "unavailable" };
  }
}

export async function listPublicCatalog(
  filters: PublicProductFilters = {},
): Promise<
  PublicCatalogResult<{
    products: PublicProductSummary[];
    facets: PublicCatalogFacets;
  }>
> {
  try {
    const { data, error } = await queryPublicProducts();
    if (error) return { data: null, error: "unavailable" };
    const products = data.map(normalizeProductSummary);
    return {
      data: {
        products: filterProducts(products, filters).slice(0, 48),
        facets: catalogFacets(products),
      },
      error: null,
    };
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
