"use server";

import { createHash, randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  requireListingManager,
  requireVerifiedMarketplacePartner,
} from "@/lib/auth/marketplace-authorization";
import type { PartnerActionState } from "@/lib/marketplace/partner-action-state";
import { getMarketplaceListingDetail } from "@/lib/marketplace/listing-data";
import {
  MARKETPLACE_LISTING_IMAGES_BUCKET,
  getSpecFields,
  listingConditionSchema,
  listingIdentitySchema,
  listingImagePath,
  listingInventorySchema,
  reviewAreaCopy,
  validateListingImage,
  validateListingImageSignature,
} from "@/lib/marketplace/listing-rules";

function value(formData: FormData, key: string): string {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry : "";
}

function listingFailure(message: string): PartnerActionState {
  if (message.includes("version conflict"))
    return {
      status: "error",
      message:
        "La publicación cambió en otra sesión. Actualiza la página antes de continuar.",
    };
  if (message.includes("not ready"))
    return {
      status: "error",
      message: "Completa los puntos pendientes antes de enviar.",
    };
  if (
    message.includes("access denied") ||
    message.includes("required") ||
    message.includes("permission")
  )
    return {
      status: "error",
      message: "No tienes permiso para realizar esta acción.",
    };
  return {
    status: "error",
    message: "No pudimos guardar la publicación. Inténtalo nuevamente.",
  };
}

const listingIdSchema = z.uuid();
const lockVersionSchema = z.coerce.number().int().positive();

export async function createMarketplaceListingAction(
  _previous: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const categoryId = z.uuid().safeParse(value(formData, "category_id"));
  if (!categoryId.success)
    return { status: "error", message: "Selecciona una categoría." };
  const { client } = await requireVerifiedMarketplacePartner(
    "/partner/publicaciones/nueva",
  );
  const result = await client.rpc("create_marketplace_listing", {
    requested_category_id: categoryId.data,
  });
  if (result.error) return listingFailure(result.error.message);
  revalidatePath("/partner/publicaciones");
  redirect(`/partner/publicaciones/${result.data.id}/producto`);
}

async function verifiedListingActionContext(formData: FormData) {
  const listingId = listingIdSchema.safeParse(value(formData, "listing_id"));
  const lockVersion = lockVersionSchema.safeParse(
    value(formData, "lock_version"),
  );
  if (!listingId.success || !lockVersion.success) return null;
  const context = await requireVerifiedMarketplacePartner(
    `/partner/publicaciones/${listingId.data}`,
  );
  return {
    ...context,
    listingId: listingId.data,
    lockVersion: lockVersion.data,
  };
}

export async function saveListingIdentityAction(
  _previous: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const context = await verifiedListingActionContext(formData);
  if (!context) return { status: "error", message: "Publicación inválida." };
  const parsed = listingIdentitySchema.safeParse({
    canonical_model_id: value(formData, "canonical_model_id"),
    brand_id: value(formData, "brand_id"),
    proposed_brand: value(formData, "proposed_brand"),
    proposed_model: value(formData, "proposed_model"),
    title: value(formData, "title"),
    description: value(formData, "description"),
  });
  if (!parsed.success)
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ?? "Revisa la identidad del producto.",
    };
  const result = await context.client.rpc("save_marketplace_listing_draft", {
    requested_listing_id: context.listingId,
    expected_lock_version: context.lockVersion,
    requested_payload: {
      canonicalModelId: parsed.data.canonical_model_id,
      brandId: parsed.data.brand_id,
      proposedBrand: parsed.data.proposed_brand,
      proposedModel: parsed.data.proposed_model,
      title: parsed.data.title,
      description: parsed.data.description,
    },
  });
  if (result.error) return listingFailure(result.error.message);
  revalidatePath(`/partner/publicaciones/${context.listingId}`, "layout");
  redirect(`/partner/publicaciones/${context.listingId}/fotos`);
}

export async function saveListingSpecsAction(
  _previous: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const context = await verifiedListingActionContext(formData);
  if (!context) return { status: "error", message: "Publicación inválida." };
  const detail = await getMarketplaceListingDetail(context.listingId);
  const profile = detail.version?.categories?.category_spec_profiles ?? null;
  const fields = getSpecFields(profile);
  const specifications: Record<string, string | number | boolean | string[]> =
    {};
  for (const field of fields) {
    const raw = value(formData, `spec_${field.key}`).trim();
    if (field.required && !raw)
      return {
        status: "error",
        message: `Completa ${field.label.toLowerCase()}.`,
      };
    if (!raw && field.type !== "checkbox") continue;
    if (field.type === "checkbox") {
      specifications[field.key] = formData.get(`spec_${field.key}`) === "on";
    } else if (field.type === "number") {
      const numeric = Number(raw);
      if (!Number.isFinite(numeric) || numeric <= 0)
        return {
          status: "error",
          message: `${field.label} debe ser un número positivo.`,
        };
      specifications[field.key] = numeric;
    } else if (field.key === "components") {
      specifications[field.key] = raw
        .split(/[,\n]/)
        .map((entry) => entry.trim())
        .filter(Boolean);
      if (!(specifications[field.key] as string[]).length)
        return {
          status: "error",
          message: "Agrega la composición del set.",
        };
    } else {
      specifications[field.key] = raw;
    }
  }
  const result = await context.client.rpc("save_marketplace_listing_draft", {
    requested_listing_id: context.listingId,
    expected_lock_version: context.lockVersion,
    requested_payload: { specifications },
  });
  if (result.error) return listingFailure(result.error.message);
  revalidatePath(`/partner/publicaciones/${context.listingId}`, "layout");
  redirect(`/partner/publicaciones/${context.listingId}/condicion`);
}

export async function saveListingConditionAction(
  _previous: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const context = await verifiedListingActionContext(formData);
  if (!context) return { status: "error", message: "Publicación inválida." };
  const defects = value(formData, "declared_defects")
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const parsed = listingConditionSchema.safeParse({
    condition: value(formData, "condition"),
    condition_grade: value(formData, "condition_grade"),
    condition_notes: value(formData, "condition_notes"),
    declared_defects: defects,
    defects_acknowledged: formData.get("defects_acknowledged") === "on",
  });
  if (!parsed.success)
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ?? "Revisa la condición declarada.",
    };
  const result = await context.client.rpc("save_marketplace_listing_draft", {
    requested_listing_id: context.listingId,
    expected_lock_version: context.lockVersion,
    requested_payload: {
      condition: parsed.data.condition,
      conditionGrade: parsed.data.condition_grade,
      conditionNotes: parsed.data.condition_notes,
      declaredDefects: parsed.data.declared_defects,
      defectsAcknowledged: parsed.data.defects_acknowledged,
    },
  });
  if (result.error) return listingFailure(result.error.message);
  revalidatePath(`/partner/publicaciones/${context.listingId}`, "layout");
  redirect(`/partner/publicaciones/${context.listingId}/inventario`);
}

export async function saveListingInventoryAction(
  _previous: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const context = await verifiedListingActionContext(formData);
  if (!context) return { status: "error", message: "Publicación inválida." };
  const parsed = listingInventorySchema.safeParse({
    quantity: value(formData, "quantity"),
    custody: value(formData, "custody"),
    fulfillment: value(formData, "fulfillment"),
  });
  if (!parsed.success)
    return { status: "error", message: "Revisa la cantidad y custodia." };
  const result = await context.client.rpc("save_marketplace_listing_draft", {
    requested_listing_id: context.listingId,
    expected_lock_version: context.lockVersion,
    requested_payload: {
      quantity: parsed.data.quantity,
      custody: parsed.data.custody,
      fulfillment: parsed.data.fulfillment,
    },
  });
  if (result.error) return listingFailure(result.error.message);
  revalidatePath(`/partner/publicaciones/${context.listingId}`, "layout");
  redirect(`/partner/publicaciones/${context.listingId}/revision`);
}

export async function uploadListingImageAction(
  _previous: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const context = await verifiedListingActionContext(formData);
  if (!context) return { status: "error", message: "Publicación inválida." };
  const file = formData.get("image");
  const imageType = value(formData, "image_type");
  if (!(file instanceof File))
    return { status: "error", message: "Selecciona una imagen." };
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(imageType))
    return { status: "error", message: "Selecciona el tipo de foto." };
  const metadataError = validateListingImage(file);
  if (metadataError) return { status: "error", message: metadataError };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validateListingImageSignature(file.type, bytes.slice(0, 16)))
    return {
      status: "error",
      message: "El contenido no coincide con el formato declarado.",
    };
  const detail = await getMarketplaceListingDetail(context.listingId);
  if (!detail.version)
    return { status: "error", message: "Publicación no disponible." };
  const imageId = randomUUID();
  const storagePath = listingImagePath(
    context.partner.id,
    context.listingId,
    detail.version.id,
    imageId,
    file.type,
  );
  if (!storagePath)
    return { status: "error", message: "No pudimos preparar la imagen." };
  const upload = await context.client.storage
    .from(MARKETPLACE_LISTING_IMAGES_BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (upload.error) return listingFailure(upload.error.message);
  const registration = await context.client.rpc(
    "register_marketplace_listing_image",
    {
      requested_listing_id: context.listingId,
      expected_lock_version: context.lockVersion,
      requested_image_id: imageId,
      requested_storage_path: storagePath,
      requested_image_type: imageType,
      requested_alt_text: `${detail.version.title ?? "Producto"} — ${imageType}`,
      requested_mime_type: file.type,
      requested_size_bytes: file.size,
      requested_sha256: createHash("sha256").update(bytes).digest("hex"),
    },
  );
  if (registration.error) {
    await context.client.storage
      .from(MARKETPLACE_LISTING_IMAGES_BUCKET)
      .remove([storagePath]);
    return listingFailure(registration.error.message);
  }
  revalidatePath(`/partner/publicaciones/${context.listingId}`, "layout");
  return { status: "success", message: "Foto agregada al borrador." };
}

export async function removeListingImageAction(
  _previous: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const context = await verifiedListingActionContext(formData);
  const imageId = z.uuid().safeParse(value(formData, "image_id"));
  if (!context || !imageId.success)
    return { status: "error", message: "Imagen inválida." };
  const result = await context.client.rpc("remove_marketplace_listing_image", {
    requested_listing_id: context.listingId,
    expected_lock_version: context.lockVersion,
    requested_image_id: imageId.data,
  });
  if (result.error) return listingFailure(result.error.message);
  const removal = result.data[0];
  if (removal?.delete_storage_object && removal.removed_storage_path) {
    await context.client.storage
      .from(MARKETPLACE_LISTING_IMAGES_BUCKET)
      .remove([removal.removed_storage_path]);
  }
  revalidatePath(`/partner/publicaciones/${context.listingId}`, "layout");
  return { status: "success", message: "Foto retirada de esta versión." };
}

export async function reorderListingImagesAction(
  _previous: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const context = await verifiedListingActionContext(formData);
  const imageIds = value(formData, "image_ids").split(",").filter(Boolean);
  const parsedImageIds = z.array(z.uuid()).min(1).safeParse(imageIds);
  if (!context || !parsedImageIds.success)
    return { status: "error", message: "Orden de imágenes inválido." };
  const result = await context.client.rpc(
    "reorder_marketplace_listing_images",
    {
      requested_listing_id: context.listingId,
      expected_lock_version: context.lockVersion,
      requested_image_ids: parsedImageIds.data,
    },
  );
  if (result.error) return listingFailure(result.error.message);
  revalidatePath(`/partner/publicaciones/${context.listingId}`, "layout");
  return { status: "success", message: "Orden de fotos actualizado." };
}

export async function submitMarketplaceListingAction(
  _previous: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const context = await verifiedListingActionContext(formData);
  if (!context) return { status: "error", message: "Publicación inválida." };
  const result = await context.client.rpc("submit_marketplace_listing", {
    requested_listing_id: context.listingId,
    expected_lock_version: context.lockVersion,
  });
  if (result.error) return listingFailure(result.error.message);
  revalidatePath("/partner/publicaciones");
  redirect(`/partner/publicaciones/${context.listingId}`);
}

export async function resolveListingProductAction(
  _previous: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const listingId = z.uuid().safeParse(value(formData, "listing_id"));
  const lockVersion = lockVersionSchema.safeParse(
    value(formData, "lock_version"),
  );
  const modelId = z
    .union([z.uuid(), z.literal("")])
    .safeParse(value(formData, "model_id"));
  const brandId = z
    .union([z.uuid(), z.literal("")])
    .safeParse(value(formData, "brand_id"));
  const modelName = value(formData, "model_name").trim();
  const reason = value(formData, "reason").trim();
  if (
    !listingId.success ||
    !lockVersion.success ||
    !modelId.success ||
    !brandId.success ||
    reason.length < 3 ||
    (!modelId.data && (!brandId.data || modelName.length < 1))
  )
    return {
      status: "error",
      message: "Selecciona o crea el modelo canónico y explica la resolución.",
    };
  const { client } = await requireListingManager(
    `/operacion/marketplace/publicaciones/${listingId.data}`,
  );
  const result = await client.rpc("resolve_marketplace_listing_product", {
    requested_listing_id: listingId.data,
    expected_lock_version: lockVersion.data,
    requested_model_id: modelId.data || null,
    requested_brand_id: brandId.data || null,
    requested_model_name: modelName,
    requested_reason: reason,
  });
  if (result.error) return listingFailure(result.error.message);
  revalidatePath(`/operacion/marketplace/publicaciones/${listingId.data}`);
  return { status: "success", message: "Producto canónico vinculado." };
}

export async function transitionListingReviewAction(
  _previous: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const listingId = z.uuid().safeParse(value(formData, "listing_id"));
  const lockVersion = lockVersionSchema.safeParse(
    value(formData, "lock_version"),
  );
  const status = z
    .enum(["UNDER_REVIEW", "CHANGES_REQUESTED", "APPROVED", "REJECTED"])
    .safeParse(value(formData, "status"));
  const area = z
    .enum([
      "PHOTOS",
      "SPECS",
      "CONDITION",
      "DESCRIPTION",
      "PRODUCT_IDENTITY",
      "QUANTITY",
      "OTHER",
    ])
    .safeParse(value(formData, "area"));
  const reason = value(formData, "reason").trim();
  const feedback = value(formData, "feedback").trim();
  const internalNote = value(formData, "internal_note").trim();
  if (
    !listingId.success ||
    !lockVersion.success ||
    !status.success ||
    reason.length < 3
  )
    return { status: "error", message: "Completa la decisión y el motivo." };
  if (
    status.data === "CHANGES_REQUESTED" &&
    (!area.success || feedback.length < 3)
  )
    return {
      status: "error",
      message: "Indica exactamente qué debe corregir el Partner.",
    };
  const { client } = await requireListingManager(
    `/operacion/marketplace/publicaciones/${listingId.data}`,
  );
  const result = await client.rpc("transition_marketplace_listing_status", {
    requested_listing_id: listingId.data,
    expected_lock_version: lockVersion.data,
    requested_status: status.data,
    requested_reason: reason,
    requested_feedback:
      status.data === "CHANGES_REQUESTED" && area.success
        ? [{ area: area.data, comment: feedback }]
        : [],
    requested_internal_note: internalNote || null,
  });
  if (result.error) return listingFailure(result.error.message);
  revalidatePath("/operacion/marketplace/publicaciones", "layout");
  return {
    status: "success",
    message:
      status.data === "CHANGES_REQUESTED"
        ? `Cambios solicitados en ${reviewAreaCopy[area.data!]}.`
        : "Estado de revisión actualizado.",
  };
}
