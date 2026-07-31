import { describe, expect, it } from "vitest";

import {
  MAX_PRODUCT_IMAGE_BYTES,
  generateProductImageStoragePath,
  getDeleteCompensation,
  normalizeImageOrder,
  promotePrimaryAfterRemoval,
  validateAltText,
  validateFileMetadata,
  validateFileSignature,
  validateUploadCount,
  canMarkConditionEvidence,
} from "@/lib/catalog/product-image-rules";

const productId = "7f1a86ef-ae15-4f8a-8bb2-0cf5f414bf4b";
const imageId = "5445b0de-cdb8-4864-a755-aa6715d289a0";

describe("product image rules", () => {
  it("validates MIME type, extension, and size", () => {
    expect(
      validateFileMetadata({
        name: "foto.jpg",
        type: "image/jpeg",
        size: MAX_PRODUCT_IMAGE_BYTES,
      }),
    ).toBeNull();
    expect(
      validateFileMetadata({
        name: "foto.svg",
        type: "image/svg+xml",
        size: 100,
      }),
    ).toContain("JPEG");
    expect(
      validateFileMetadata({
        name: "foto.png",
        type: "image/jpeg",
        size: 100,
      }),
    ).toContain("no coincide");
    expect(
      validateFileMetadata({
        name: "foto.webp",
        type: "image/webp",
        size: MAX_PRODUCT_IMAGE_BYTES + 1,
      }),
    ).toContain("5 MiB");
  });

  it("checks common binary signatures without image-processing dependencies", () => {
    expect(
      validateFileSignature(
        "image/png",
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe(true);
    expect(
      validateFileSignature("image/png", new Uint8Array([0x3c, 0x73])),
    ).toBe(false);
  });

  it("generates only predictable paths from UUIDs and approved MIME types", () => {
    expect(
      generateProductImageStoragePath(productId, "image/webp", imageId),
    ).toBe(`products/${productId}/${imageId}.webp`);
    expect(
      generateProductImageStoragePath("../escape", "image/webp", imageId),
    ).toBeNull();
    expect(
      generateProductImageStoragePath(productId, "image/svg+xml", imageId),
    ).toBeNull();
  });

  it("limits the number of files per operation", () => {
    expect(validateUploadCount(4)).toBeNull();
    expect(validateUploadCount(5)).toContain("hasta 4");
    expect(validateUploadCount(0)).toContain("al menos");
  });

  it("normalizes ordering deterministically", () => {
    expect(normalizeImageOrder(["b", "a"])).toEqual([
      { id: "b", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
    ]);
  });

  it("promotes the first remaining image when the primary is removed", () => {
    expect(
      promotePrimaryAfterRemoval(
        [
          { id: "b", sortOrder: 10, isPrimary: false },
          { id: "a", sortOrder: 0, isPrimary: true },
          { id: "c", sortOrder: 10, isPrimary: false },
        ],
        "a",
      ),
    ).toEqual([
      { id: "b", sortOrder: 10, isPrimary: true },
      { id: "c", sortOrder: 10, isPrimary: false },
    ]);
  });

  it("validates alt text and condition evidence", () => {
    expect(validateAltText("Vista frontal del producto")).toBeNull();
    expect(validateAltText("   ")).toContain("entre 1");
    expect(validateAltText("x".repeat(301))).toContain("300");
    expect(canMarkConditionEvidence("used", true)).toBe(true);
    expect(canMarkConditionEvidence("new", true)).toBe(false);
  });

  it("plans restoration when Storage deletion fails", () => {
    const snapshot = {
      id: imageId,
      storagePath: `products/${productId}/${imageId}.jpg`,
      altText: "Vista frontal",
      sortOrder: 0,
      isPrimary: true,
      isConditionEvidence: false,
    };
    expect(getDeleteCompensation(false, snapshot)).toEqual({
      kind: "restore-record",
      snapshot,
    });
    expect(getDeleteCompensation(true, snapshot)).toEqual({ kind: "complete" });
  });
});
