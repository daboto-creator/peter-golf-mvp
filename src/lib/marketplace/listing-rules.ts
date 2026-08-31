import { z } from "zod";

import type { Database } from "@/types/database.types";

export type MarketplaceListingStatus =
  Database["public"]["Enums"]["marketplace_listing_status"];
export type MarketplaceReviewArea =
  Database["public"]["Enums"]["marketplace_listing_review_area"];
export type ProductCondition = Database["public"]["Enums"]["product_condition"];
export type ProductConditionGrade =
  Database["public"]["Enums"]["product_condition_grade"];

export const MARKETPLACE_LISTING_IMAGES_BUCKET = "marketplace-listing-images";
export const MAX_LISTING_IMAGE_BYTES = 10 * 1024 * 1024;

export const listingStatusCopy: Record<
  MarketplaceListingStatus,
  { label: string; description: string }
> = {
  DRAFT: {
    label: "Borrador",
    description: "Continúa completando la publicación cuando quieras.",
  },
  SUBMITTED: {
    label: "En revisión por Best Round",
    description: "Best Round recibirá esta versión para revisión.",
  },
  UNDER_REVIEW: {
    label: "En revisión por Best Round",
    description: "Operations está revisando esta versión.",
  },
  CHANGES_REQUESTED: {
    label: "Requiere ajustes",
    description: "Actualiza los puntos indicados y vuelve a enviar.",
  },
  APPROVED: {
    label: "Aprobado",
    description:
      "Best Round aprobó la publicación; aparecerá automáticamente cuando cumpla la disponibilidad.",
  },
  PUBLISHED: {
    label: "Publicado",
    description: "Tu producto está disponible en el catálogo Best Round.",
  },
  PAUSED: {
    label: "Pausado",
    description: "La publicación no está disponible temporalmente.",
  },
  SOLD: {
    label: "Agotado",
    description:
      "La publicación se conserva en tu historial sin inventario disponible.",
  },
  REJECTED: {
    label: "No aprobado",
    description: "Revisa la razón compartida por Best Round.",
  },
  EXPIRED: {
    label: "Expirado",
    description: "Estado preparado para confirmación futura de disponibilidad.",
  },
  ARCHIVED: {
    label: "Archivado",
    description: "La información se conserva en tu historial.",
  },
};

export const partnerEditableListingStatuses = new Set<MarketplaceListingStatus>(
  ["DRAFT", "CHANGES_REQUESTED"],
);

export function isMarketplaceListingStatus(
  value: string,
): value is MarketplaceListingStatus {
  return value in listingStatusCopy;
}

export const reviewTransitions: Record<
  MarketplaceListingStatus,
  MarketplaceListingStatus[]
> = {
  DRAFT: ["SUBMITTED", "ARCHIVED"],
  SUBMITTED: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["CHANGES_REQUESTED", "APPROVED", "REJECTED"],
  CHANGES_REQUESTED: ["SUBMITTED", "ARCHIVED"],
  APPROVED: ["ARCHIVED"],
  PUBLISHED: [],
  PAUSED: [],
  SOLD: [],
  REJECTED: ["ARCHIVED"],
  EXPIRED: [],
  ARCHIVED: [],
};

export function canTransitionListing(
  from: MarketplaceListingStatus,
  to: MarketplaceListingStatus,
): boolean {
  return reviewTransitions[from].includes(to);
}

export const conditionGradeCopy: Record<ProductConditionGrade, string> = {
  like_new: "Como nuevo",
  excellent: "Excelente",
  very_good: "Muy bueno",
  good: "Bueno",
  fair: "Con uso visible",
};

export const reviewAreaCopy: Record<MarketplaceReviewArea, string> = {
  PHOTOS: "Fotos",
  SPECS: "Especificaciones",
  CONDITION: "Condición",
  DESCRIPTION: "Descripción",
  PRODUCT_IDENTITY: "Producto",
  QUANTITY: "Cantidad",
  OTHER: "Otro",
};

export type CategoryProfile = {
  family: Database["public"]["Enums"]["golf_product_family"];
  club_type: Database["public"]["Enums"]["golf_club_type"] | null;
  bag_type: Database["public"]["Enums"]["golf_bag_type"] | null;
  set_type: Database["public"]["Enums"]["golf_set_type"] | null;
};

export type SpecField = {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "checkbox" | "textarea";
  required?: boolean;
  options?: ReadonlyArray<{ value: string; label: string }>;
};

const handOptions = [
  { value: "right", label: "Derecho" },
  { value: "left", label: "Izquierdo" },
] as const;
const flexOptions = [
  { value: "ladies", label: "Ladies" },
  { value: "senior", label: "Senior" },
  { value: "regular", label: "Regular" },
  { value: "stiff", label: "Stiff" },
  { value: "x_stiff", label: "X-Stiff" },
  { value: "other", label: "Otro" },
] as const;

export function getSpecFields(profile: CategoryProfile | null): SpecField[] {
  if (!profile) return [];
  if (profile.family === "bag") {
    return [
      { key: "color", label: "Color", type: "text" },
      { key: "dividerCount", label: "Divisores", type: "number" },
      { key: "pocketCount", label: "Bolsillos", type: "number" },
      { key: "rainHoodIncluded", label: "Incluye rain hood", type: "checkbox" },
    ];
  }
  if (profile.family === "set") {
    return [
      {
        key: "components",
        label: "Composición del set",
        type: "textarea",
        required: true,
      },
      {
        key: "handedness",
        label: "Mano",
        type: "select",
        options: handOptions,
      },
      { key: "shaftFlex", label: "Flex", type: "select", options: flexOptions },
    ];
  }
  const fields: SpecField[] = [
    {
      key: "handedness",
      label: "Mano",
      type: "select",
      required: true,
      options: handOptions,
    },
  ];
  if (profile.club_type !== "putter") {
    fields.push({
      key: "shaftFlex",
      label: "Flex",
      type: "select",
      required: true,
      options: flexOptions,
    });
  }
  if (
    ["driver", "fairway_wood", "hybrid", "wedge"].includes(
      profile.club_type ?? "",
    )
  ) {
    fields.push({
      key: "loftDegrees",
      label: "Loft (°)",
      type: "number",
      required: true,
    });
  }
  if (profile.club_type === "wedge") {
    fields.push(
      { key: "bounceDegrees", label: "Bounce (°)", type: "number" },
      { key: "grind", label: "Grind", type: "text" },
    );
  }
  if (profile.club_type === "putter") {
    fields.push(
      {
        key: "lengthInches",
        label: "Largo (pulgadas)",
        type: "number",
        required: true,
      },
      {
        key: "putterHeadType",
        label: "Cabeza",
        type: "select",
        options: [
          { value: "blade", label: "Blade" },
          { value: "mallet", label: "Mallet" },
        ],
      },
    );
  }
  fields.push(
    { key: "shaftBrand", label: "Marca del shaft", type: "text" },
    { key: "shaftModel", label: "Modelo del shaft", type: "text" },
    { key: "shaftWeightGrams", label: "Peso del shaft (g)", type: "number" },
    { key: "grip", label: "Grip", type: "text" },
    { key: "modelYear", label: "Año", type: "number" },
    { key: "headcoverIncluded", label: "Incluye headcover", type: "checkbox" },
  );
  return fields;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((entry) => entry || null);

export const listingIdentitySchema = z
  .object({
    canonical_model_id: z
      .union([z.uuid(), z.literal("")])
      .transform((entry) => entry || null),
    brand_id: z
      .union([z.uuid(), z.literal("")])
      .transform((entry) => entry || null),
    proposed_brand: optionalText(120),
    proposed_model: optionalText(160),
    title: z.string().trim().min(3).max(180),
    description: z
      .string()
      .trim()
      .min(3)
      .max(4000)
      .refine((entry) => !/<[^>]+>/.test(entry)),
  })
  .superRefine((entry, context) => {
    if (
      !entry.canonical_model_id &&
      (!entry.proposed_model || (!entry.brand_id && !entry.proposed_brand))
    ) {
      context.addIssue({
        code: "custom",
        message: "Selecciona o propone un producto.",
      });
    }
  });

export const listingConditionSchema = z
  .object({
    condition: z.enum(["new", "used"]),
    condition_grade: z
      .union([
        z.enum(["like_new", "excellent", "very_good", "good", "fair"]),
        z.literal(""),
      ])
      .transform((entry) => entry || null),
    condition_notes: z.string().trim().min(3).max(1000),
    declared_defects: z.array(z.string().trim().min(2).max(240)).max(20),
    defects_acknowledged: z.literal(true),
  })
  .superRefine((entry, context) => {
    if (entry.condition === "used" && !entry.condition_grade) {
      context.addIssue({
        code: "custom",
        message: "Selecciona el grado de condición.",
      });
    }
  });

export const listingInventorySchema = z.object({
  quantity: z.coerce.number().int().min(1).max(100000),
  custody: z.enum(["PARTNER_CUSTODY", "BEST_ROUND_CUSTODY"]),
  fulfillment: z.enum(["PARTNER_FULFILLED", "BEST_ROUND_FULFILLED"]),
});

export function suggestListingTitle(
  parts: Array<string | number | null | undefined>,
): string {
  return parts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, 180);
}

const listingImageTypes = {
  "image/jpeg": { extension: "jpg", signature: [0xff, 0xd8, 0xff] },
  "image/png": {
    extension: "png",
    signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  "image/webp": { extension: "webp", signature: [0x52, 0x49, 0x46, 0x46] },
} as const;

export function validateListingImage(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  if (!(file.type in listingImageTypes))
    return "Usa una imagen JPEG, PNG o WebP.";
  if (file.size < 1 || file.size > MAX_LISTING_IMAGE_BYTES) {
    return "La imagen debe pesar más de 0 bytes y máximo 10 MiB.";
  }
  const configured =
    listingImageTypes[file.type as keyof typeof listingImageTypes];
  const extension = file.name.split(".").pop()?.toLowerCase();
  const accepted =
    configured.extension === "jpg" ? ["jpg", "jpeg"] : [configured.extension];
  return extension && accepted.includes(extension)
    ? null
    : "La extensión no coincide con el tipo de imagen.";
}

export function validateListingImageSignature(
  mimeType: string,
  bytes: Uint8Array,
): boolean {
  if (!(mimeType in listingImageTypes)) return false;
  const signature =
    listingImageTypes[mimeType as keyof typeof listingImageTypes].signature;
  if (!signature.every((entry, index) => bytes[index] === entry)) return false;
  return (
    mimeType !== "image/webp" ||
    (bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50)
  );
}

export function listingImagePath(
  partnerId: string,
  listingId: string,
  versionId: string,
  imageId: string,
  mimeType: string,
): string | null {
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  if (
    ![partnerId, listingId, versionId, imageId].every((entry) =>
      uuid.test(entry),
    )
  )
    return null;
  if (!(mimeType in listingImageTypes)) return null;
  const extension =
    listingImageTypes[mimeType as keyof typeof listingImageTypes].extension;
  return `listings/${partnerId}/${listingId}/${versionId}/${imageId}.${extension}`;
}

export function getListingNextStep(status: MarketplaceListingStatus): string {
  if (status === "CHANGES_REQUESTED") return "Corregir publicación";
  if (status === "DRAFT") return "Continuar borrador";
  if (status === "APPROVED") return "Ver publicación";
  if (status === "REJECTED") return "Revisar decisión";
  if (["SUBMITTED", "UNDER_REVIEW"].includes(status)) return "Esperar revisión";
  return "Ver publicación";
}
