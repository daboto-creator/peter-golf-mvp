"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCatalogManager } from "@/lib/auth/catalog-authorization";
import {
  MAX_PRODUCT_IMAGES_PER_PRODUCT,
  PRODUCT_IMAGE_BUCKET,
  canMarkConditionEvidence,
  generateProductImageStoragePath,
  getDeleteCompensation,
  validateAltText,
  validateFileMetadata,
  validateFileSignature,
  validateUploadCount,
} from "@/lib/catalog/product-image-rules";
import { createClient } from "@/lib/supabase/server";

export type ProductImageActionResult = {
  status: "idle" | "success" | "error";
  message?: string;
};

const uuidSchema = z.uuid();
const imageUpdateSchema = z.object({
  altText: z.string().trim().min(1).max(300),
  isPrimary: z.boolean(),
  isConditionEvidence: z.boolean(),
});

async function getManagedProduct(productId: string) {
  const client = await createClient();
  return client
    .from("products")
    .select("id, slug, name, condition")
    .eq("id", productId)
    .maybeSingle();
}

function refreshProductImages(productId: string, slug?: string) {
  revalidatePath(`/operacion/catalogo/${productId}/editar`);
  revalidatePath("/productos");
  if (slug) {
    revalidatePath(`/productos/${slug}`);
  }
}

export async function uploadProductImagesAction(
  productId: string,
  formData: FormData,
): Promise<ProductImageActionResult> {
  await requireCatalogManager(`/operacion/catalogo/${productId}/editar`);
  if (!uuidSchema.safeParse(productId).success) {
    return { status: "error", message: "El producto solicitado no es válido." };
  }

  const files = formData
    .getAll("images")
    .filter((entry): entry is File => entry instanceof File);
  const countError = validateUploadCount(files.length);
  if (countError) {
    return { status: "error", message: countError };
  }

  const altTextValue = formData.get("altText");
  const altText = typeof altTextValue === "string" ? altTextValue.trim() : "";
  const altError = validateAltText(altText);
  if (altError) {
    return { status: "error", message: altError };
  }

  const evidenceRequested = formData.get("isConditionEvidence") === "on";
  const productResult = await getManagedProduct(productId);
  if (productResult.error || !productResult.data) {
    return {
      status: "error",
      message: "No pudimos encontrar el producto para agregar imágenes.",
    };
  }
  if (
    !canMarkConditionEvidence(productResult.data.condition, evidenceRequested)
  ) {
    return {
      status: "error",
      message:
        "Sólo los productos seminuevos pueden usar imágenes como evidencia de condición.",
    };
  }

  const client = await createClient();
  const existingCountResult = await client
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);
  if (
    existingCountResult.error ||
    (existingCountResult.count ?? 0) + files.length >
      MAX_PRODUCT_IMAGES_PER_PRODUCT
  ) {
    return {
      status: "error",
      message: `Cada producto admite como máximo ${MAX_PRODUCT_IMAGES_PER_PRODUCT} imágenes.`,
    };
  }

  for (const file of files) {
    const metadataError = validateFileMetadata(file);
    if (metadataError) {
      return { status: "error", message: metadataError };
    }
    const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (!validateFileSignature(file.type, signature)) {
      return {
        status: "error",
        message:
          "El contenido de una imagen no coincide con el formato declarado.",
      };
    }
  }

  let completed = 0;
  for (const file of files) {
    const storagePath = generateProductImageStoragePath(
      productId,
      file.type,
      randomUUID(),
    );
    if (!storagePath) {
      return {
        status: "error",
        message: "No pudimos generar una ruta segura para la imagen.",
      };
    }

    const uploadResult = await client.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .upload(storagePath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });
    if (uploadResult.error) {
      return {
        status: "error",
        message:
          completed > 0
            ? `Se guardaron ${completed} imágenes; no fue posible completar las demás.`
            : "No pudimos subir las imágenes. Inténtalo de nuevo.",
      };
    }

    const registration = await client.rpc("register_product_image", {
      requested_product_id: productId,
      requested_storage_path: storagePath,
      requested_alt_text: altText,
      requested_is_condition_evidence: evidenceRequested,
    });
    if (registration.error) {
      const cleanup = await client.storage
        .from(PRODUCT_IMAGE_BUCKET)
        .remove([storagePath]);
      return {
        status: "error",
        message: cleanup.error
          ? "No pudimos registrar una imagen y su limpieza requiere revisión operativa."
          : completed > 0
            ? `Se guardaron ${completed} imágenes; no fue posible completar las demás.`
            : "No pudimos registrar las imágenes. Inténtalo de nuevo.",
      };
    }
    completed += 1;
  }

  refreshProductImages(productId, productResult.data.slug);
  return {
    status: "success",
    message:
      completed === 1
        ? "La imagen se agregó correctamente."
        : `Se agregaron ${completed} imágenes correctamente.`,
  };
}

export async function updateProductImageAction(
  productId: string,
  imageId: string,
  values: {
    altText: string;
    isPrimary: boolean;
    isConditionEvidence: boolean;
  },
): Promise<ProductImageActionResult> {
  await requireCatalogManager(`/operacion/catalogo/${productId}/editar`);
  if (
    !uuidSchema.safeParse(productId).success ||
    !uuidSchema.safeParse(imageId).success
  ) {
    return { status: "error", message: "La imagen solicitada no es válida." };
  }
  const parsed = imageUpdateSchema.safeParse(values);
  if (!parsed.success || validateAltText(values.altText)) {
    return {
      status: "error",
      message: "Revisa el texto alternativo de la imagen.",
    };
  }

  const productResult = await getManagedProduct(productId);
  if (productResult.error || !productResult.data) {
    return { status: "error", message: "El producto ya no está disponible." };
  }
  if (
    !canMarkConditionEvidence(
      productResult.data.condition,
      parsed.data.isConditionEvidence,
    )
  ) {
    return {
      status: "error",
      message:
        "Sólo los productos seminuevos pueden usar evidencia de condición.",
    };
  }

  const client = await createClient();
  const result = await client.rpc("update_product_image", {
    requested_product_id: productId,
    requested_image_id: imageId,
    requested_alt_text: parsed.data.altText,
    requested_is_primary: parsed.data.isPrimary,
    requested_is_condition_evidence: parsed.data.isConditionEvidence,
  });
  if (result.error || result.data !== true) {
    return {
      status: "error",
      message: "No pudimos actualizar la imagen. Recarga e inténtalo de nuevo.",
    };
  }

  refreshProductImages(productId, productResult.data.slug);
  return { status: "success", message: "La imagen se actualizó." };
}

export async function reorderProductImagesAction(
  productId: string,
  imageIds: string[],
): Promise<ProductImageActionResult> {
  await requireCatalogManager(`/operacion/catalogo/${productId}/editar`);
  const parsed = z
    .array(z.uuid())
    .max(MAX_PRODUCT_IMAGES_PER_PRODUCT)
    .safeParse(imageIds);
  if (!uuidSchema.safeParse(productId).success || !parsed.success) {
    return { status: "error", message: "El orden solicitado no es válido." };
  }

  const client = await createClient();
  const result = await client.rpc("reorder_product_images", {
    requested_product_id: productId,
    requested_image_ids: parsed.data,
  });
  if (result.error || result.data !== true) {
    return {
      status: "error",
      message: "Las imágenes cambiaron. Recarga antes de volver a ordenarlas.",
    };
  }

  const productResult = await getManagedProduct(productId);
  refreshProductImages(productId, productResult.data?.slug);
  return { status: "success", message: "El orden se actualizó." };
}

export async function deleteProductImageAction(
  productId: string,
  imageId: string,
): Promise<ProductImageActionResult> {
  await requireCatalogManager(`/operacion/catalogo/${productId}/editar`);
  if (
    !uuidSchema.safeParse(productId).success ||
    !uuidSchema.safeParse(imageId).success
  ) {
    return { status: "error", message: "La imagen solicitada no es válida." };
  }

  const client = await createClient();
  const removal = await client.rpc("remove_product_image", {
    requested_product_id: productId,
    requested_image_id: imageId,
  });
  const deleted = removal.data?.[0];
  if (removal.error || !deleted) {
    return {
      status: "error",
      message: "La imagen ya no existe o pertenece a otro producto.",
    };
  }

  const storageRemoval = await client.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .remove([deleted.storage_path]);
  const compensation = getDeleteCompensation(!storageRemoval.error, {
    id: deleted.id,
    storagePath: deleted.storage_path,
    altText: deleted.alt_text,
    sortOrder: deleted.sort_order,
    isPrimary: deleted.is_primary,
    isConditionEvidence: deleted.is_condition_evidence,
  });

  if (compensation.kind === "restore-record") {
    const snapshot = compensation.snapshot;
    const restoration = await client.rpc("restore_product_image", {
      requested_product_id: productId,
      requested_image_id: snapshot.id,
      requested_storage_path: snapshot.storagePath,
      requested_alt_text: snapshot.altText,
      requested_sort_order: snapshot.sortOrder,
      requested_is_primary: snapshot.isPrimary,
      requested_is_condition_evidence: snapshot.isConditionEvidence,
    });
    return {
      status: "error",
      message:
        restoration.error || restoration.data !== true
          ? "La eliminación no terminó y requiere revisión operativa antes de reintentar."
          : "Storage no pudo eliminar el archivo; el registro se restauró de forma segura.",
    };
  }

  const productResult = await getManagedProduct(productId);
  refreshProductImages(productId, productResult.data?.slug);
  return { status: "success", message: "La imagen se eliminó correctamente." };
}
