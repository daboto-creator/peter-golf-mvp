import { describe, expect, it } from "vitest";

import fs from "node:fs";
import path from "node:path";

import { CURATED_BRAND_SLUGS, canonicalBrandSlug, resolveBrandAsset } from "./brand-assets";

describe("Mi Golf brand assets", () => {
  it("normalizes canonical brand variants to one slug", () => {
    expect(canonicalBrandSlug("TITLEIST")).toBe("titleist");
    expect(canonicalBrandSlug("Taylor Made")).toBe("taylor-made");
    expect(canonicalBrandSlug("Cleveland Golf")).toBe("cleveland-golf");
  });

  it("resolves a covered brand to a local asset", () => {
    expect(resolveBrandAsset({ brandName: "Titleist" })).toEqual({
      logoSrc: "/brands/titleist.svg",
      alt: "Titleist",
      hasLogo: true,
      slug: "titleist",
    });
  });

  it("covers every curated brand with an existing local asset", () => {
    expect(CURATED_BRAND_SLUGS).toHaveLength(18);

    for (const slug of CURATED_BRAND_SLUGS) {
      const resolved = resolveBrandAsset({ brandSlug: slug });
      expect(resolved.hasLogo, slug).toBe(true);
      expect(resolved.logoSrc, slug).toMatch(/^\/brands\//);
      expect(resolved.logoSrc, slug).not.toMatch(/^https?:/);
      const localPath = path.join(process.cwd(), "public", resolved.logoSrc!.replace(/^\/+/u, ""));
      expect(fs.existsSync(localPath), localPath).toBe(true);
      expect(path.extname(localPath), localPath).toMatch(/^\.(svg|png|webp)$/u);
    }
  });

  it("keeps an uncovered brand functional with a fallback", () => {
    expect(resolveBrandAsset({ brandName: "Miura" })).toEqual({
      logoSrc: null,
      alt: "Miura",
      hasLogo: false,
      slug: "miura",
    });
  });
});
