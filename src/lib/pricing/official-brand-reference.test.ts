import { describe, expect, it } from "vitest";

import {
  isOfficialBrandUrl,
  officialBrandDomain,
  UnavailableOfficialBrandReferenceResolver,
} from "@/lib/pricing/official-brand-reference";

describe("official manufacturer reference policy", () => {
  it("accepts only canonical manufacturer domains", () => {
    expect(officialBrandDomain("Titleist")).toBe("titleist.com");
    expect(
      isOfficialBrandUrl("Titleist", "https://www.titleist.com/golf-clubs/gt3"),
    ).toBe(true);
    expect(
      isOfficialBrandUrl("Titleist", "https://titleist.example.com/gt3"),
    ).toBe(false);
    expect(
      isOfficialBrandUrl("Titleist", "https://retailer.example/titleist-gt3"),
    ).toBe(false);
  });

  it("fails safe when no official price resolver is configured", async () => {
    const result =
      await new UnavailableOfficialBrandReferenceResolver().resolve({
        brand: "Titleist",
        model: "GT3",
        market: "MX",
      });
    expect(result.status).toBe("OFFICIAL_PRICE_NOT_AVAILABLE");
    expect(result.priceMxnMinor).toBeNull();
  });
});
