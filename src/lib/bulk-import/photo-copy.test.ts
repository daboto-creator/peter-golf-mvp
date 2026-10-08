import { describe, expect, test } from "vitest";
import { bulkPhotoSourceCopy } from "./photo-copy";

describe("bulk import photo UX copy", () => {
  test("explains separate sources and Clave fotos", () => {
    expect(Object.values(bulkPhotoSourceCopy).join(" ")).toContain("Fotografías");
    expect(Object.values(bulkPhotoSourceCopy).join(" ")).toContain("Google Drive");
    expect(Object.values(bulkPhotoSourceCopy).join(" ")).toContain("Archivo ZIP");
    expect(Object.values(bulkPhotoSourceCopy).join(" ")).toContain("Clave fotos");
    expect(bulkPhotoSourceCopy.driveOutsideCsv).toContain("no va dentro del CSV");
  });
});
