import { describe, expect, it } from "vitest";

import { analyzeListingImages } from "@/lib/marketplace/image-intelligence";

describe("listing image intelligence rules", () => {
  it("requires five real photos for a club", () => {
    const result = analyzeListingImages({
      images: Array.from({ length: 4 }, (_, index) => ({
        sha256: String(index).padStart(64, "0"),
        widthPixels: 1200,
        heightPixels: 900,
        imageType: "overview",
      })),
      isClub: true,
      declaredBrand: "Titleist",
      declaredModel: "GT3",
    });
    expect(result.sufficient).toBe(false);
    expect(result.warnings).toContain("INSUFFICIENT_REAL_PHOTOS");
    expect(result.summary).not.toContain("auténtico");
  });

  it("detects duplicate image content", () => {
    const image = {
      sha256: "a".repeat(64),
      widthPixels: 1200,
      heightPixels: 900,
      imageType: "overview",
    };
    expect(
      analyzeListingImages({
        images: [image, image],
        isClub: false,
        declaredBrand: null,
        declaredModel: null,
      }).warnings,
    ).toContain("DUPLICATE_PHOTOS");
  });
});
