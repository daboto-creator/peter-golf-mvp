import { describe, expect, it } from "vitest";
import { parseDriveFolderReference, resolvePhotoKeyCollisions, validateZipEntryPath, isAllowedImageMime } from "./photos";

describe("bulk import photo safety", () => {
  it("flags inaccessible Drive references without blocking CSV parsing", () => {
    expect(parseDriveFolderReference("https://drive.google.com/drive/u/0/my-drive").code).toBe("DRIVE_FOLDER_NOT_ACCESSIBLE");
    expect(parseDriveFolderReference("https://drive.google.com/drive/folders/abc_123").status).toBe("PENDING_ACCESS");
  });
  it("detects normalized photo-key collisions and unsafe paths", () => {
    expect(resolvePhotoKeyCollisions(["GT3 001", "gt3_001"]).collisions).toEqual(["gt3-001"]);
    expect(validateZipEntryPath("../secret.txt")).toBe(false);
    expect(validateZipEntryPath("images/GT3-001-01.jpg")).toBe(true);
    expect(isAllowedImageMime("image/webp")).toBe(true);
    expect(isAllowedImageMime("application/javascript")).toBe(false);
  });
});
