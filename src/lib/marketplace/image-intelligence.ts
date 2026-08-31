export type ListingImageSignal = {
  sha256: string;
  widthPixels: number | null;
  heightPixels: number | null;
  imageType: string;
};

export function analyzeListingImages(input: {
  images: ListingImageSignal[];
  isClub: boolean;
  declaredBrand: string | null;
  declaredModel: string | null;
}) {
  const warnings: string[] = [];
  const minimum = input.isClub ? 5 : 1;
  if (input.images.length < minimum) warnings.push("INSUFFICIENT_REAL_PHOTOS");
  if (
    new Set(input.images.map((image) => image.sha256)).size <
    input.images.length
  )
    warnings.push("DUPLICATE_PHOTOS");
  if (
    input.images.some(
      (image) =>
        image.widthPixels !== null &&
        image.heightPixels !== null &&
        Math.min(image.widthPixels, image.heightPixels) < 600,
    )
  )
    warnings.push("LOW_RESOLUTION_PHOTO");
  if (input.images.some((image) => !image.widthPixels || !image.heightPixels))
    warnings.push("IMAGE_DIMENSIONS_PENDING");
  if (input.declaredBrand || input.declaredModel)
    warnings.push("VISUAL_PRODUCT_CONSISTENCY_REVIEW_REQUIRED");
  return {
    sufficient: !warnings.includes("INSUFFICIENT_REAL_PHOTOS"),
    result: warnings.length ? "REVIEW_REQUIRED" : "PASSED",
    warnings,
    summary:
      input.declaredBrand || input.declaredModel
        ? `Fotos pendientes de confirmar consistencia con ${[input.declaredBrand, input.declaredModel].filter(Boolean).join(" ")}`
        : "Fotos pendientes de revisión de producto",
  } as const;
}
