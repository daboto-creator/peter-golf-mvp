export const PRODUCT_IMAGE_BUCKET = "product-images";
export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PRODUCT_IMAGES_PER_UPLOAD = 4;
export const MAX_PRODUCT_IMAGES_PER_PRODUCT = 24;
export const MAX_PRODUCT_IMAGE_ALT_TEXT_LENGTH = 300;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const fileTypes = {
  "image/jpeg": {
    extension: "jpg",
    matches(bytes: Uint8Array) {
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    },
  },
  "image/png": {
    extension: "png",
    matches(bytes: Uint8Array) {
      return (
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
      );
    },
  },
  "image/webp": {
    extension: "webp",
    matches(bytes: Uint8Array) {
      return (
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      );
    },
  },
} as const;

export type ProductImageMimeType = keyof typeof fileTypes;
export type ProductImageExtension =
  (typeof fileTypes)[ProductImageMimeType]["extension"];

export type ProductImageOrderItem = {
  id: string;
  sortOrder: number;
  isPrimary: boolean;
};

export type DeletedImageSnapshot = {
  id: string;
  storagePath: string;
  altText: string;
  sortOrder: number;
  isPrimary: boolean;
  isConditionEvidence: boolean;
};

export function isUuid(value: string): boolean {
  return uuidPattern.test(value);
}

export function validateUploadCount(count: number): string | null {
  if (count < 1) {
    return "Selecciona al menos una imagen.";
  }
  if (count > MAX_PRODUCT_IMAGES_PER_UPLOAD) {
    return `Puedes subir hasta ${MAX_PRODUCT_IMAGES_PER_UPLOAD} imágenes por operación.`;
  }
  return null;
}

export function getImageExtension(
  mimeType: string,
): ProductImageExtension | null {
  return mimeType in fileTypes
    ? fileTypes[mimeType as ProductImageMimeType].extension
    : null;
}

export function validateFileMetadata(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  const extension = getImageExtension(file.type);
  if (!extension) {
    return "Sólo se aceptan imágenes JPEG, PNG o WebP.";
  }
  if (file.size < 1 || file.size > MAX_PRODUCT_IMAGE_BYTES) {
    return "Cada imagen debe pesar más de 0 bytes y máximo 5 MiB.";
  }

  const suppliedExtension = file.name.split(".").pop()?.toLowerCase();
  const allowedExtensions =
    file.type === "image/jpeg" ? ["jpg", "jpeg"] : [extension];
  if (!suppliedExtension || !allowedExtensions.includes(suppliedExtension)) {
    return "La extensión del archivo no coincide con su tipo MIME.";
  }

  return null;
}

export function validateFileSignature(
  mimeType: string,
  bytes: Uint8Array,
): boolean {
  return (
    mimeType in fileTypes &&
    fileTypes[mimeType as ProductImageMimeType].matches(bytes)
  );
}

export function generateProductImageStoragePath(
  productId: string,
  mimeType: string,
  randomId: string,
): string | null {
  const extension = getImageExtension(mimeType);
  if (!isUuid(productId) || !isUuid(randomId) || !extension) {
    return null;
  }

  return `products/${productId}/${randomId}.${extension}`;
}

export function validateAltText(value: string): string | null {
  const normalized = value.trim();
  if (
    normalized.length < 1 ||
    normalized.length > MAX_PRODUCT_IMAGE_ALT_TEXT_LENGTH
  ) {
    return `El texto alternativo debe tener entre 1 y ${MAX_PRODUCT_IMAGE_ALT_TEXT_LENGTH} caracteres.`;
  }
  return null;
}

export function canMarkConditionEvidence(
  condition: "new" | "used",
  requested: boolean,
): boolean {
  return !requested || condition === "used";
}

export function normalizeImageOrder(
  imageIds: string[],
): Array<{ id: string; sortOrder: number }> {
  return imageIds.map((id, sortOrder) => ({ id, sortOrder }));
}

export function promotePrimaryAfterRemoval(
  images: ProductImageOrderItem[],
  removedId: string,
): ProductImageOrderItem[] {
  const remaining = images
    .filter((image) => image.id !== removedId)
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.id.localeCompare(right.id),
    );

  if (remaining.length > 0 && !remaining.some((image) => image.isPrimary)) {
    remaining[0] = { ...remaining[0], isPrimary: true };
  }
  return remaining;
}

export function getDeleteCompensation(
  storageRemovalSucceeded: boolean,
  snapshot: DeletedImageSnapshot,
):
  | { kind: "complete" }
  | { kind: "restore-record"; snapshot: DeletedImageSnapshot } {
  return storageRemovalSucceeded
    ? { kind: "complete" }
    : { kind: "restore-record", snapshot };
}
