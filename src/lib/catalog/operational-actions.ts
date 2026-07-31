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
  type ProductMutationInput,
} from "@/lib/catalog/product-validation";
import {
  getProductMutationCondition,
  type ProductMutationCondition,
} from "@/lib/catalog/product-transition";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
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

function toProductMutationPayload(values: ProductMutationInput): ProductUpdate {
  return {
    name: values.name,
    slug: values.slug,
    sku: values.sku,
    brand_id: values.brandId,
    category_id: values.categoryId,
    short_description: values.shortDescription,
    description: values.description,
    condition: values.condition,
    condition_grade: values.conditionGrade,
    condition_notes: values.conditionNotes,
    fulfillment_type: values.fulfillmentType,
    price: values.price,
    compare_at_price: values.compareAtPrice,
    currency: values.currency,
    price_is_estimate: values.priceIsEstimate,
    lead_time_min_days: values.leadTimeMinDays,
    lead_time_max_days: values.leadTimeMaxDays,
    featured: values.featured,
    published: values.published,
    status: values.published ? "active" : "draft",
  };
}

function toProductInsertPayload(values: ProductMutationInput): ProductInsert {
  return {
    ...toProductMutationPayload(values),
    brand_id: values.brandId,
    category_id: values.categoryId,
    condition: values.condition,
    fulfillment_type: values.fulfillmentType,
    name: values.name,
    price: values.price,
    sku: values.sku,
    slug: values.slug,
    archived_at: null,
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

  if (excludeId) {
    slugQuery = slugQuery.neq("id", excludeId);
    skuQuery = skuQuery.neq("id", excludeId);
  }

  const [slugResult, skuResult] = await Promise.all([
    slugQuery.limit(1),
    skuQuery.limit(1),
  ]);
  const errors: Record<string, string[] | undefined> = {};

  if (!slugResult.error && slugResult.data.length > 0) {
    errors.slug = ["Ya existe un producto con este slug."];
  }
  if (!skuResult.error && skuResult.data.length > 0) {
    errors.sku = ["Ya existe un producto con este SKU."];
  }

  return errors;
}

function databaseMutationFailure(code?: string): CatalogActionResult {
  return {
    status: "error",
    message:
      code === "23505"
        ? "Ya existe un producto con ese slug o SKU. Revísalos e inténtalo de nuevo."
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
    .from("products")
    .insert(toProductInsertPayload(validated.data))
    .select("id")
    .single();

  if (error || !data) {
    return databaseMutationFailure(error?.code);
  }

  revalidatePath("/operacion/catalogo");
  revalidatePath("/productos");
  redirect(`/operacion/catalogo/${data.id}/editar?creado=1`);
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
    .from("products")
    .update(toProductMutationPayload(validated.data))
    .eq("id", parsedId.data)
    .is("archived_at", null)
    .eq("status", expectedState.status)
    .neq("status", "archived")
    .eq("published", expectedState.published)
    .select("id")
    .maybeSingle();

  if (error) {
    return databaseMutationFailure(error?.code);
  }
  if (!data) {
    return productStateChangedFailure();
  }

  revalidatePath("/operacion/catalogo");
  revalidatePath(`/operacion/catalogo/${parsedId.data}/editar`);
  revalidatePath("/productos");
  revalidatePath(`/productos/${existing.data.slug}`);

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
