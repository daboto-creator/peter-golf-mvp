"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireCatalogManager } from "@/lib/auth/catalog-authorization";
import type { TaxonomyActionResult } from "@/lib/catalog/catalog-action-state";
import { listOperationalCategories } from "@/lib/catalog/operational-taxonomies";
import {
  taxonomySlugConflictMessage,
  validateBrandForm,
  validateCategoryForm,
  wouldCreateCategoryCycle,
  type BrandFormValues,
  type CategoryFormValues,
} from "@/lib/catalog/taxonomy-validation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type CatalogStatus = Database["public"]["Enums"]["catalog_record_status"];
type BrandInsert = Database["public"]["Tables"]["brands"]["Insert"];
type BrandUpdate = Database["public"]["Tables"]["brands"]["Update"];
type CategoryInsert = Database["public"]["Tables"]["categories"]["Insert"];
type CategoryUpdate = Database["public"]["Tables"]["categories"]["Update"];

const idSchema = z.uuid();

function validationFailure(
  errors: Record<string, string[] | undefined>,
): TaxonomyActionResult {
  return { status: "error", message: "Revisa los campos marcados.", errors };
}

function mutationFailure(
  kind: "brand" | "category",
  code?: string,
): TaxonomyActionResult {
  return {
    status: "error",
    message:
      code === "23505"
        ? `${taxonomySlugConflictMessage(kind)} Revisa también que el nombre no esté repetido.`
        : "No pudimos guardar los cambios. Inténtalo de nuevo.",
  };
}

async function slugExists(
  table: "brands" | "categories",
  slug: string,
  excludeId?: string,
): Promise<boolean | null> {
  const client = await createClient();
  let query = client.from(table).select("id").eq("slug", slug);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query.limit(1);
  return error ? null : data.length > 0;
}

function revalidateTaxonomies() {
  revalidatePath("/operacion");
  revalidatePath("/operacion/taxonomias");
  revalidatePath("/operacion/taxonomias/marcas");
  revalidatePath("/operacion/taxonomias/categorias");
  revalidatePath("/operacion/catalogo");
  revalidatePath("/operacion/catalogo/nuevo");
  revalidatePath("/productos");
}

export async function createBrandAction(
  values: BrandFormValues,
): Promise<TaxonomyActionResult> {
  await requireCatalogManager("/operacion/taxonomias/marcas/nueva");
  const validated = validateBrandForm(values);
  if (!validated.success) return validationFailure(validated.errors);

  if ((await slugExists("brands", validated.data.slug)) === true) {
    return validationFailure({
      slug: [taxonomySlugConflictMessage("brand")],
    });
  }

  const payload: BrandInsert = {
    name: validated.data.name,
    slug: validated.data.slug,
    description: validated.data.description || null,
    status: validated.data.status,
  };
  const client = await createClient();
  const { data, error } = await client
    .from("brands")
    .insert(payload)
    .select("id")
    .single();
  if (error || !data) return mutationFailure("brand", error?.code);

  revalidateTaxonomies();
  redirect(`/operacion/taxonomias/marcas/${data.id}/editar?creada=1`);
}

export async function updateBrandAction(
  brandId: string,
  values: BrandFormValues,
): Promise<TaxonomyActionResult> {
  await requireCatalogManager(`/operacion/taxonomias/marcas/${brandId}/editar`);
  const parsedId = idSchema.safeParse(brandId);
  if (!parsedId.success) {
    return { status: "error", message: "La marca solicitada no es válida." };
  }
  const validated = validateBrandForm(values);
  if (!validated.success) return validationFailure(validated.errors);
  if (
    (await slugExists("brands", validated.data.slug, parsedId.data)) === true
  ) {
    return validationFailure({
      slug: [taxonomySlugConflictMessage("brand")],
    });
  }

  const payload: BrandUpdate = {
    name: validated.data.name,
    slug: validated.data.slug,
    description: validated.data.description || null,
  };
  const client = await createClient();
  const { data, error } = await client
    .from("brands")
    .update(payload)
    .eq("id", parsedId.data)
    .select("id")
    .maybeSingle();
  if (error) return mutationFailure("brand", error.code);
  if (!data)
    return { status: "error", message: "La marca ya no está disponible." };

  revalidateTaxonomies();
  revalidatePath(`/operacion/taxonomias/marcas/${parsedId.data}/editar`);
  return { status: "success", message: "La marca se actualizó correctamente." };
}

export async function createCategoryAction(
  values: CategoryFormValues,
): Promise<TaxonomyActionResult> {
  await requireCatalogManager("/operacion/taxonomias/categorias/nueva");
  const validated = validateCategoryForm(values);
  if (!validated.success) return validationFailure(validated.errors);
  if ((await slugExists("categories", validated.data.slug)) === true) {
    return validationFailure({
      slug: [taxonomySlugConflictMessage("category")],
    });
  }

  if (validated.data.parentId) {
    const categories = await listOperationalCategories();
    const parent = categories.data?.find(
      (category) => category.id === validated.data.parentId,
    );
    if (categories.error || !parent || parent.status !== "active") {
      return validationFailure({
        parentId: ["Selecciona una categoría padre activa."],
      });
    }
  }

  const payload: CategoryInsert = {
    name: validated.data.name,
    slug: validated.data.slug,
    description: validated.data.description || null,
    status: validated.data.status,
    parent_id: validated.data.parentId,
    sort_order: validated.data.sortOrder,
  };
  const client = await createClient();
  const { data, error } = await client
    .from("categories")
    .insert(payload)
    .select("id")
    .single();
  if (error || !data) return mutationFailure("category", error?.code);

  revalidateTaxonomies();
  redirect(`/operacion/taxonomias/categorias/${data.id}/editar?creada=1`);
}

export async function updateCategoryAction(
  categoryId: string,
  values: CategoryFormValues,
): Promise<TaxonomyActionResult> {
  await requireCatalogManager(
    `/operacion/taxonomias/categorias/${categoryId}/editar`,
  );
  const parsedId = idSchema.safeParse(categoryId);
  if (!parsedId.success) {
    return {
      status: "error",
      message: "La categoría solicitada no es válida.",
    };
  }
  const validated = validateCategoryForm(values);
  if (!validated.success) return validationFailure(validated.errors);
  if (validated.data.parentId === parsedId.data) {
    return validationFailure({
      parentId: ["Una categoría no puede ser su propio padre."],
    });
  }

  const categories = await listOperationalCategories();
  if (categories.error) {
    return { status: "error", message: "No pudimos validar la jerarquía." };
  }
  const parent = validated.data.parentId
    ? categories.data.find(
        (category) => category.id === validated.data.parentId,
      )
    : null;
  const current = categories.data.find(
    (category) => category.id === parsedId.data,
  );
  if (
    validated.data.parentId &&
    (!parent ||
      (parent.status !== "active" &&
        current?.parentId !== validated.data.parentId))
  ) {
    return validationFailure({
      parentId: ["Selecciona una categoría padre activa."],
    });
  }
  if (
    wouldCreateCategoryCycle(
      parsedId.data,
      validated.data.parentId,
      categories.data,
    )
  ) {
    return validationFailure({ parentId: ["Esa relación crearía un ciclo."] });
  }
  if (
    (await slugExists("categories", validated.data.slug, parsedId.data)) ===
    true
  ) {
    return validationFailure({
      slug: [taxonomySlugConflictMessage("category")],
    });
  }

  const payload: CategoryUpdate = {
    name: validated.data.name,
    slug: validated.data.slug,
    description: validated.data.description || null,
    parent_id: validated.data.parentId,
    sort_order: validated.data.sortOrder,
  };
  const client = await createClient();
  const { data, error } = await client
    .from("categories")
    .update(payload)
    .eq("id", parsedId.data)
    .select("id")
    .maybeSingle();
  if (error) return mutationFailure("category", error.code);
  if (!data) {
    return { status: "error", message: "La categoría ya no está disponible." };
  }

  revalidateTaxonomies();
  revalidatePath(`/operacion/taxonomias/categorias/${parsedId.data}/editar`);
  return {
    status: "success",
    message: "La categoría se actualizó correctamente.",
  };
}

async function changeTaxonomyStatus(
  kind: "brand" | "category",
  id: string,
  requestedStatus: CatalogStatus,
): Promise<TaxonomyActionResult> {
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { status: "error", message: "El registro solicitado no es válido." };
  }
  const client = await createClient();
  const table = kind === "brand" ? "brands" : "categories";
  const currentStatus: CatalogStatus =
    requestedStatus === "active" ? "archived" : "active";

  if (requestedStatus === "archived") {
    const foreignKey = kind === "brand" ? "brand_id" : "category_id";
    const productCheck = await client
      .from("products")
      .select("id")
      .eq(foreignKey, parsedId.data)
      .or("status.eq.active,published.eq.true")
      .limit(1);
    if (productCheck.error) {
      return {
        status: "error",
        message: "No pudimos validar las dependencias.",
      };
    }
    if (productCheck.data.length > 0) {
      return {
        status: "error",
        message:
          "No se puede archivar mientras tenga productos activos o publicados.",
      };
    }
    if (kind === "category") {
      const childCheck = await client
        .from("categories")
        .select("id")
        .eq("parent_id", parsedId.data)
        .eq("status", "active")
        .limit(1);
      if (childCheck.error) {
        return {
          status: "error",
          message: "No pudimos validar las dependencias.",
        };
      }
      if (childCheck.data.length > 0) {
        return {
          status: "error",
          message: "Archiva o reasigna primero las categorías hijas activas.",
        };
      }
    }
  }

  const { data, error } = await client
    .from(table)
    .update({ status: requestedStatus })
    .eq("id", parsedId.data)
    .eq("status", currentStatus)
    .select("id")
    .maybeSingle();
  if (error) {
    return {
      status: "error",
      message:
        requestedStatus === "archived"
          ? "No se puede archivar porque el registro aún tiene dependencias activas."
          : "No pudimos reactivar el registro. Verifica su jerarquía.",
    };
  }
  if (!data) {
    return {
      status: "error",
      message: "El estado cambió. Actualiza la página e inténtalo de nuevo.",
    };
  }

  revalidateTaxonomies();
  return {
    status: "success",
    message:
      requestedStatus === "active"
        ? "El registro quedó activo."
        : "El registro quedó archivado sin eliminarse.",
  };
}

export async function changeBrandStatusAction(
  brandId: string,
  status: CatalogStatus,
): Promise<TaxonomyActionResult> {
  await requireCatalogManager(`/operacion/taxonomias/marcas/${brandId}/editar`);
  const parsedStatus = z.enum(["active", "archived"]).safeParse(status);
  return parsedStatus.success
    ? changeTaxonomyStatus("brand", brandId, parsedStatus.data)
    : { status: "error", message: "El estado solicitado no es válido." };
}

export async function changeCategoryStatusAction(
  categoryId: string,
  status: CatalogStatus,
): Promise<TaxonomyActionResult> {
  await requireCatalogManager(
    `/operacion/taxonomias/categorias/${categoryId}/editar`,
  );
  const parsedStatus = z.enum(["active", "archived"]).safeParse(status);
  return parsedStatus.success
    ? changeTaxonomyStatus("category", categoryId, parsedStatus.data)
    : { status: "error", message: "El estado solicitado no es válido." };
}
