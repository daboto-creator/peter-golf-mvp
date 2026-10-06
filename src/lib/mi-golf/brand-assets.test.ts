import { describe, expect, it } from "vitest";

import { canonicalBrandSlug, resolveBrandAsset } from "./brand-assets";

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

  it("keeps an uncovered brand functional with a fallback", () => {
    expect(resolveBrandAsset({ brandName: "Miura" })).toEqual({
      logoSrc: null,
      alt: "Miura",
      hasLogo: false,
      slug: "miura",
    });
  });
});
