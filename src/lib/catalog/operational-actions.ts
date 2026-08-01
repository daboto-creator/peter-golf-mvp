"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireCatalogManager } from "@/lib/auth/catalog-authorization";
import {
  getOperationalProductById,
  productToFormValues,
} from "@/lib/catalog/operational-products";
import {
  validateProductForm,
  type ProductFormValues,
} from "@/lib/catalog/product-validation";
import {
  getProductMutationCondition,
  type ProductMutationCondition,
} from "@/lib/catalog/product-transition";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];

export type CatalogActionResult = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

const productIdSchema = z.uuid();

function validationFailure(
  errors: Record<string, string[] | undefined>,
): CatalogActionResult {
  return {
    status: "error",
    message: "Revisa los campos marcados.",
    errors,
  };
}

async function referencesAreActive(
  brandId: string,
  categoryId: string,
  current?: { brandId: string; categoryId: string },
): Promise<boolean> {
  const client = await createClient();
  const [brand, category] = await Promise.all([
    client.from("brands").select("id, status").eq("id", brandId).maybeSingle(),
    client
      .from("categories")
      .select("id, status")
      .eq("id", categoryId)
      .maybeSingle(),
  ]);

  return (
    !brand.error &&
    !category.error &&
    brand.data !== null &&
    category.data !== null &&
    (brand.data.status === "active" || current?.brandId === brandId) &&
    (category.data.status === "active" || current?.categoryId === categoryId)
  );
}

async function findIdentityConflicts({
  slug,
  sku,
  excludeId,
}: {
  slug: string;
  sku: string;
  excludeId?: string;
}): Promise<Record<string, string[] | undefined>> {
  const client = await createClient();
  let slugQuery = client.from("products").select("id").eq("slug", slug);
  let skuQuery = client.from("products").select("id").eq("sku", sku);
  let variantSkuQuery = client
    .from("product_variants")
    .select("id, product_id")
    .eq("sku", sku);

  if (excludeId) {
    slugQuery = slugQuery.neq("id", excludeId);
    skuQuery = skuQuery.neq("id", excludeId);
    variantSkuQuery = variantSkuQuery.neq("product_id", excludeId);
  }

  const [slugResult, skuResult, variantSkuResult] = await Promise.all([
    slugQuery.limit(1),
    skuQuery.limit(1),
    variantSkuQuery.limit(1),
  ]);
  const errors: Record<string, string[] | undefined> = {};

  if (!slugResult.error && slugResult.data.length > 0) {
    errors.slug = ["Ya existe un producto con este slug."];
  }
  if (
    (!skuResult.error && skuResult.data.length > 0) ||
    (!variantSkuResult.error && variantSkuResult.data.length > 0)
  ) {
    errors.sku = ["Ya existe un producto o variante con este SKU."];
  }

  return errors;
}

function databaseMutationFailure(code?: string): CatalogActionResult {
  return {
    status: "error",
    message:
      code === "23505"
        ? "Ya existe otro producto o variante con ese slug o SKU. Revísalos e inténtalo de nuevo."
        : "No pudimos guardar el producto. Inténtalo de nuevo.",
  };
}

function productStateChangedFailure(): CatalogActionResult {
  return {
    status: "error",
    message:
      "El producto cambió de estado mientras trabajabas. Actualiza la página e inténtalo de nuevo.",
  };
}

export async function createProductAction(
  values: ProductFormValues,
): Promise<CatalogActionResult> {
  await requireCatalogManager("/operacion/catalogo/nuevo");
  const validated = validateProductForm(values);

  if (!validated.success) {
    return validationFailure(validated.errors);
  }

  if (
    !(await referencesAreActive(
      validated.data.brandId,
      validated.data.categoryId,
    ))
  ) {
    return validationFailure({
      brandId: [
        "La marca o categoría seleccionada ya no está disponible. Actualiza la página.",
      ],
      categoryId: [
        "La marca o categoría seleccionada ya no está disponible. Actualiza la página.",
      ],
    });
  }

  const conflicts = await findIdentityConflicts({
    slug: validated.data.slug,
    sku: validated.data.sku,
  });
  if (Object.keys(conflicts).length > 0) {
    return validationFailure(conflicts);
  }

  const client = await createClient();
  const { data, error } = await client
    .rpc("create_product_with_base_variant", {
      requested_brand_id: validated.data.brandId,
      requested_category_id: validated.data.categoryId,
      requested_compare_at_price: validated.data.compareAtPrice,
      requested_condition: validated.data.condition,
      requested_condition_grade: validated.data.conditionGrade,
      requested_condition_notes: validated.data.conditionNotes,
      requested_currency: validated.data.currency,
      requested_description: validated.data.description,
      requested_featured: validated.data.featured,
      requested_fulfillment_type: validated.data.fulfillmentType,
      requested_lead_time_max_days: validated.data.leadTimeMaxDays,
      requested_lead_time_min_days: validated.data.leadTimeMinDays,
      requested_name: validated.data.name,
      requested_price: validated.data.price,
      requested_price_is_estimate: validated.data.priceIsEstimate,
      requested_published: validated.data.published,
      requested_short_description: validated.data.shortDescription,
      requested_sku: validated.data.sku,
      requested_slug: validated.data.slug,
    })
    .single();

  if (error || !data) {
    return databaseMutationFailure(error?.code);
  }

  revalidatePath("/operacion/catalogo");
  revalidatePath("/operacion/inventario");
  revalidatePath("/productos");
  redirect(`/operacion/catalogo/${data.product_id}/editar?creado=1`);
}

export async function repairProductBaseVariantAction(
  productId: string,
): Promise<CatalogActionResult> {
  await requireCatalogManager(`/operacion/inventario/${productId}`);
  const parsedId = productIdSchema.safeParse(productId);
  if (!parsedId.success) {
    return { status: "error", message: "El producto solicitado no es válido." };
  }

  const client = await createClient();
  const { data, error } = await client
    .rpc("repair_product_base_variant", {
      requested_product_id: parsedId.data,
    })
    .single();

  if (error || !data) {
    return {
      status: "error",
      message:
        error?.code === "23505"
          ? "El producto ya tiene variantes y requiere revisión antes de continuar."
          : error?.code === "22023"
            ? "Este producto no se puede reparar como variante base. Verifica su estado y SKU."
            : "No pudimos crear la variante base. Inténtalo de nuevo.",
    };
  }

  revalidatePath("/operacion/catalogo");
  revalidatePath(`/operacion/catalogo/${parsedId.data}/editar`);
  revalidatePath("/operacion/inventario");
  revalidatePath(`/operacion/inventario/${parsedId.data}`);
  revalidatePath("/productos");

  return {
    status: "success",
    message: data.created
      ? "La variante base quedó creada. Ya puedes inicializar el inventario."
      : "La variante base ya existía; no se creó un duplicado.",
  };
}

export async function updateProductAction(
  productId: string,
  values: ProductFormValues,
): Promise<CatalogActionResult> {
  await requireCatalogManager(`/operacion/catalogo/${productId}/editar`);
  const parsedId = productIdSchema.safeParse(productId);
  if (!parsedId.success) {
    return { status: "error", message: "El producto solicitado no es válido." };
  }

  const validated = validateProductForm(values);
  if (!validated.success) {
    return validationFailure(validated.errors);
  }

  const existing = await getOperationalProductById(parsedId.data);
  if (existing.error || !existing.data) {
    return {
      status: "error",
      message: "No pudimos encontrar el producto para actualizarlo.",
    };
  }
  const expectedState = getProductMutationCondition("edit", existing.data);
  if (!expectedState) {
    return {
      status: "error",
      message: "Restaura el producto antes de editarlo.",
    };
  }

  if (
    !(await referencesAreActive(
      validated.data.brandId,
      validated.data.categoryId,
      {
        brandId: existing.data.brandId,
        categoryId: existing.data.categoryId,
      },
    ))
  ) {
    return validationFailure({
      brandId: [
        "Sólo puedes conservar la relación archivada actual o elegir una marca activa.",
      ],
      categoryId: [
        "Sólo puedes conservar la relación archivada actual o elegir una categoría activa.",
      ],
    });
  }

  if (
    existing.data.condition === "used" &&
    validated.data.condition === "new"
  ) {
    const client = await createClient();
    const evidence = await client
      .from("product_images")
      .select("id")
      .eq("product_id", parsedId.data)
      .eq("is_condition_evidence", true)
      .limit(1);
    if (evidence.error || evidence.data.length > 0) {
      return validationFailure({
        condition: [
          "Desmarca primero todas las imágenes de evidencia de condición.",
        ],
      });
    }
  }

  const conflicts = await findIdentityConflicts({
    slug: validated.data.slug,
    sku: validated.data.sku,
    excludeId: parsedId.data,
  });
  if (Object.keys(conflicts).length > 0) {
    return validationFailure(conflicts);
  }

  const client = await createClient();
  const { data, error } = await client
    .rpc("update_product_with_base_variant", {
      expected_published: expectedState.published,
      expected_status: expectedState.status,
      requested_brand_id: validated.data.brandId,
      requested_category_id: validated.data.categoryId,
      requested_compare_at_price: validated.data.compareAtPrice,
      requested_condition: validated.data.condition,
      requested_condition_grade: validated.data.conditionGrade,
      requested_condition_notes: validated.data.conditionNotes,
      requested_currency: validated.data.currency,
      requested_description: validated.data.description,
      requested_featured: validated.data.featured,
      requested_fulfillment_type: validated.data.fulfillmentType,
      requested_lead_time_max_days: validated.data.leadTimeMaxDays,
      requested_lead_time_min_days: validated.data.leadTimeMinDays,
      requested_name: validated.data.name,
      requested_price: validated.data.price,
      requested_price_is_estimate: validated.data.priceIsEstimate,
      requested_product_id: parsedId.data,
      requested_published: validated.data.published,
      requested_short_description: validated.data.shortDescription,
      requested_sku: validated.data.sku,
      requested_slug: validated.data.slug,
    })
    .single();

  if (error) {
    if (error.code === "40001") return productStateChangedFailure();
    if (error.code === "22023") {
      return {
        status: "error",
        message:
          "Este producto necesita una variante base canónica antes de editarse. Repara los productos sin variante o revisa su configuración de variantes.",
      };
    }
    return databaseMutationFailure(error?.code);
  }
  if (!data) {
    return productStateChangedFailure();
  }

  revalidatePath("/operacion/catalogo");
  revalidatePath(`/operacion/catalogo/${parsedId.data}/editar`);
  revalidatePath("/operacion/inventario");
  revalidatePath(`/operacion/inventario/${parsedId.data}`);
  revalidatePath("/productos");
  revalidatePath(`/productos/${existing.data.slug}`);
  revalidatePath(`/productos/${validated.data.slug}`);

  return {
    status: "success",
    message: "El producto se actualizó correctamente.",
  };
}

async function updateProductState(
  productId: string,
  changes: ProductUpdate,
  expectedState: ProductMutationCondition,
  successMessage: string,
): Promise<CatalogActionResult> {
  const parsedId = productIdSchema.safeParse(productId);
  if (!parsedId.success) {
    return { status: "error", message: "El producto solicitado no es válido." };
  }

  const client = await createClient();
  let updateQuery = client
    .from("products")
    .update(changes)
    .eq("id", parsedId.data)
    .eq("status", expectedState.status)
    .eq("published", expectedState.published);

  updateQuery =
    expectedState.archiveState === "archived"
      ? updateQuery.not("archived_at", "is", null)
      : updateQuery.is("archived_at", null).neq("status", "archived");

  const { data, error } = await updateQuery.select("id").maybeSingle();

  if (error) {
    return {
      status: "error",
      message: "No pudimos cambiar el estado del producto.",
    };
  }
  if (!data) {
    return productStateChangedFailure();
  }

  revalidatePath("/operacion/catalogo");
  revalidatePath(`/operacion/catalogo/${parsedId.data}/editar`);
  revalidatePath("/productos");
  return { status: "success", message: successMessage };
}

export async function publishProductAction(
  productId: string,
): Promise<CatalogActionResult> {
  await requireCatalogManager(`/operacion/catalogo/${productId}/editar`);
  const product = await getOperationalProductById(productId);

  if (product.error || !product.data) {
    return {
      status: "error",
      message: "No fue posible publicar este producto.",
    };
  }
  const expectedState = getProductMutationCondition("publish", product.data);
  if (!expectedState) {
    return {
      status: "error",
      message: "No fue posible publicar este producto.",
    };
  }

  const validation = validateProductForm({
    ...productToFormValues(product.data),
    published: true,
  });
  if (!validation.success) {
    return {
      status: "error",
      message:
        "Completa los campos obligatorios del producto antes de publicarlo.",
      errors: validation.errors,
    };
  }

  if (
    !(await referencesAreActive(
      validation.data.brandId,
      validation.data.categoryId,
    ))
  ) {
    return {
      status: "error",
      message:
        "La marca o categoría ya no está activa. Selecciona referencias vigentes antes de publicar.",
    };
  }

  return updateProductState(
    productId,
    { published: true, status: "active" },
    expectedState,
    "El producto quedó publicado.",
  );
}

export async function unpublishProductAction(
  productId: string,
): Promise<CatalogActionResult> {
  await requireCatalogManager(`/operacion/catalogo/${productId}/editar`);
  const product = await getOperationalProductById(productId);
  if (product.error || !product.data) {
    return {
      status: "error",
      message: "No fue posible despublicar este producto.",
    };
  }
  const expectedState = getProductMutationCondition("unpublish", product.data);
  if (!expectedState) {
    return {
      status: "error",
      message: "No fue posible despublicar este producto.",
    };
  }

  return updateProductState(
    productId,
    { published: false, status: "draft" },
    expectedState,
    "El producto dejó de estar publicado.",
  );
}

export async function archiveProductAction(
  productId: string,
): Promise<CatalogActionResult> {
  await requireCatalogManager(`/operacion/catalogo/${productId}/editar`);
  const product = await getOperationalProductById(productId);
  if (product.error || !product.data) {
    return {
      status: "error",
      message: "No fue posible archivar este producto.",
    };
  }
  const expectedState = getProductMutationCondition("archive", product.data);
  if (!expectedState) {
    return {
      status: "error",
      message: "No fue posible archivar este producto.",
    };
  }

  return updateProductState(
    productId,
    {
      published: false,
      status: "archived",
      archived_at: new Date().toISOString(),
    },
    expectedState,
    "El producto quedó archivado.",
  );
}

export async function restoreProductAction(
  productId: string,
): Promise<CatalogActionResult> {
  await requireCatalogManager(`/operacion/catalogo/${productId}/editar`);
  const product = await getOperationalProductById(productId);

  if (product.error || !product.data) {
    return {
      status: "error",
      message: "No fue posible restaurar este producto.",
    };
  }
  const expectedState = getProductMutationCondition("restore", product.data);
  if (!expectedState) {
    return {
      status: "error",
      message: "Este producto no está archivado.",
    };
  }
  if (
    !(await referencesAreActive(product.data.brandId, product.data.categoryId))
  ) {
    return {
      status: "error",
      message:
        "La marca o categoría ya no está activa. Activa las referencias antes de restaurar.",
    };
  }

  return updateProductState(
    productId,
    { published: false, status: "draft", archived_at: null },
    expectedState,
    "El producto se restauró como borrador.",
  );
}
