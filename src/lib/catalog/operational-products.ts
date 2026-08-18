import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  minorUnitsToPriceInput,
  type ProductFormValues,
} from "@/lib/catalog/product-validation";
import { selectAssignableTaxonomies } from "@/lib/catalog/taxonomy-validation";
import type { Database } from "@/types/database.types";

type ProductCondition = Database["public"]["Enums"]["product_condition"];
type ProductConditionGrade =
  Database["public"]["Enums"]["product_condition_grade"];
type ProductStatus = Database["public"]["Enums"]["product_status"];
type FulfillmentType = Database["public"]["Enums"]["fulfillment_type"];

export type CatalogReference = {
  id: string;
  name: string;
  slug?: string;
  parentId?: string | null;
  status: Database["public"]["Enums"]["catalog_record_status"];
  family?: Database["public"]["Enums"]["golf_product_family"] | null;
  clubType?: Database["public"]["Enums"]["golf_club_type"] | null;
  bagType?: Database["public"]["Enums"]["golf_bag_type"] | null;
  setType?: Database["public"]["Enums"]["golf_set_type"] | null;
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
  conditionScore: number | null;
  targetPlayer: Database["public"]["Enums"]["product_target_player"] | null;
  productFamily: Database["public"]["Enums"]["golf_product_family"] | null;
  clubSpecs: Database["public"]["Tables"]["product_club_specs"]["Row"] | null;
  bagSpecs: Database["public"]["Tables"]["product_bag_specs"]["Row"] | null;
  setSpecs: Database["public"]["Tables"]["product_set_specs"]["Row"] | null;
  components: Database["public"]["Tables"]["product_components"]["Row"][];
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
  condition_score,
  target_player,
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
  category:categories!products_category_id_fkey(
    name,
    profile:category_spec_profiles(family)
  ),
  club_specs:product_club_specs(*),
  bag_specs:product_bag_specs(*),
  set_specs:product_set_specs(*),
  components:product_components(*)
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
    conditionScore: product.condition_score,
    targetPlayer: product.target_player,
    productFamily: product.category?.profile?.family ?? null,
    clubSpecs: product.club_specs ?? null,
    bagSpecs: product.bag_specs ?? null,
    setSpecs: product.set_specs ?? null,
    components: (product.components ?? []).sort(
      (left, right) => left.sort_order - right.sort_order,
    ),
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

export async function listActiveCatalogReferences(current?: {
  brandId: string;
  categoryId: string;
}): Promise<
  OperationalCatalogResult<{
    brands: CatalogReference[];
    categories: CatalogReference[];
  }>
> {
  try {
    const client = await createClient();
    const [brandsResult, categoriesResult] = await Promise.all([
      client.from("brands").select("id, name, status").order("name"),
      client
        .from("categories")
        .select(
          `
          id,
          parent_id,
          slug,
          name,
          status,
          profile:category_spec_profiles(family, club_type, bag_type, set_type)
        `,
        )
        .order("sort_order")
        .order("name"),
    ]);

    if (brandsResult.error || categoriesResult.error) {
      return { data: null, error: "unavailable" };
    }

    return {
      data: {
        brands: selectAssignableTaxonomies(brandsResult.data, current?.brandId),
        categories: selectAssignableTaxonomies(
          categoriesResult.data.map((category) => ({
            id: category.id,
            name: category.name,
            slug: category.slug,
            parentId: category.parent_id,
            status: category.status,
            family: category.profile?.family ?? null,
            clubType: category.profile?.club_type ?? null,
            bagType: category.profile?.bag_type ?? null,
            setType: category.profile?.set_type ?? null,
          })),
          current?.categoryId,
        ),
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
    conditionScore:
      product.conditionScore === null ? "" : String(product.conditionScore),
    conditionNotes: product.conditionNotes ?? "",
    targetPlayer: product.targetPlayer ?? "",
    productFamily: product.productFamily ?? "",
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
    ...golfDetailsToFormValues(product),
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
  conditionScore: "",
  conditionNotes: "",
  targetPlayer: "",
  productFamily: "",
  fulfillmentType: "in_stock",
  price: "",
  compareAtPrice: "",
  currency: "MXN",
  priceIsEstimate: false,
  leadTimeMinDays: "",
  leadTimeMaxDays: "",
  featured: false,
  published: false,
  clubType: "",
  bagType: "",
  setType: "",
  model: "",
  modelYear: "",
  handedness: "",
  shaftMaterial: "",
  shaftBrand: "",
  shaftModel: "",
  shaftFlex: "",
  shaftWeightGrams: "",
  clubLengthInches: "",
  gripBrand: "",
  gripModel: "",
  gripCondition: "",
  headcoverIncluded: "",
  specificationNotes: "",
  loftDegrees: "",
  adjustableLoft: "",
  adjustableHosel: "",
  adjustmentToolIncluded: "",
  clubNumber: "",
  ironNumber: "",
  bounceDegrees: "",
  grind: "",
  putterHeadType: "",
  lengthInches: "",
  lieDegrees: "",
  neckType: "",
  color: "",
  dividerCount: "",
  pocketCount: "",
  weightKg: "",
  rainHoodIncluded: "",
  strapIncluded: "",
  waterproof: "",
  cartCompatible: "",
  components: [],
};

function toInput(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

function toTriState(value: boolean | null | undefined): "" | "yes" | "no" {
  return value === null || value === undefined ? "" : value ? "yes" : "no";
}

function golfDetailsToFormValues(
  product: OperationalProduct,
): Pick<
  ProductFormValues,
  | "clubType"
  | "bagType"
  | "setType"
  | "model"
  | "modelYear"
  | "handedness"
  | "shaftMaterial"
  | "shaftBrand"
  | "shaftModel"
  | "shaftFlex"
  | "shaftWeightGrams"
  | "clubLengthInches"
  | "gripBrand"
  | "gripModel"
  | "gripCondition"
  | "headcoverIncluded"
  | "specificationNotes"
  | "loftDegrees"
  | "adjustableLoft"
  | "adjustableHosel"
  | "adjustmentToolIncluded"
  | "clubNumber"
  | "ironNumber"
  | "bounceDegrees"
  | "grind"
  | "putterHeadType"
  | "lengthInches"
  | "lieDegrees"
  | "neckType"
  | "color"
  | "dividerCount"
  | "pocketCount"
  | "weightKg"
  | "rainHoodIncluded"
  | "strapIncluded"
  | "waterproof"
  | "cartCompatible"
  | "components"
> {
  const club = product.clubSpecs;
  const bag = product.bagSpecs;
  const set = product.setSpecs;
  const common = club ?? bag ?? set;
  return {
    clubType: club?.club_type ?? "",
    bagType: bag?.bag_type ?? "",
    setType: set?.set_type ?? "",
    model: common?.model ?? "",
    modelYear: toInput(common?.model_year),
    handedness: club?.handedness ?? set?.handedness ?? "",
    shaftMaterial: club?.shaft_material ?? set?.shaft_material ?? "",
    shaftBrand: club?.shaft_brand ?? "",
    shaftModel: club?.shaft_model ?? "",
    shaftFlex: club?.shaft_flex ?? set?.shaft_flex ?? "",
    shaftWeightGrams: toInput(club?.shaft_weight_grams),
    clubLengthInches: toInput(club?.club_length_inches),
    gripBrand: club?.grip_brand ?? "",
    gripModel: club?.grip_model ?? "",
    gripCondition: club?.grip_condition ?? "",
    headcoverIncluded: toTriState(club?.headcover_included),
    specificationNotes: common?.notes ?? "",
    loftDegrees: toInput(club?.loft_degrees),
    adjustableLoft: toTriState(club?.adjustable_loft),
    adjustableHosel: toTriState(club?.adjustable_hosel),
    adjustmentToolIncluded: toTriState(club?.adjustment_tool_included),
    clubNumber: club?.club_number ?? "",
    ironNumber: club?.iron_number ?? "",
    bounceDegrees: toInput(club?.bounce_degrees),
    grind: club?.grind ?? "",
    putterHeadType: club?.putter_head_type ?? "",
    lengthInches: toInput(club?.length_inches),
    lieDegrees: toInput(club?.lie_degrees),
    neckType: club?.neck_type ?? "",
    color: bag?.color ?? "",
    dividerCount: toInput(bag?.divider_count),
    pocketCount: toInput(bag?.pocket_count),
    weightKg: toInput(bag?.weight_kg),
    rainHoodIncluded: toTriState(bag?.rain_hood_included),
    strapIncluded: toTriState(bag?.strap_included),
    waterproof: toTriState(bag?.waterproof),
    cartCompatible: toTriState(bag?.cart_compatible),
    components: product.components.map((component) => ({
      componentKind: component.component_kind,
      quantity: String(component.quantity),
      clubType: component.club_type ?? "",
      bagType: component.bag_type ?? "",
      componentNumber: component.component_number ?? "",
      loftDegrees: toInput(component.loft_degrees),
      handedness: component.handedness ?? "",
      shaftFlex: component.shaft_flex ?? "",
      shaftMaterial: component.shaft_material ?? "",
      brand: component.brand ?? "",
      model: component.model ?? "",
      condition: component.condition ?? "",
      conditionGrade: component.condition_grade ?? "",
    })),
  };
}
