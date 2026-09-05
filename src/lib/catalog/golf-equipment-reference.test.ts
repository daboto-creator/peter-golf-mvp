import { describe, expect, it } from "vitest";

import {
  dryRunGolfIdentityBackfill,
  normalizeGolfReference,
  normalizeGolfEquipmentIdentity,
  resolveGolfBrand,
  resolveGolfModel,
  type GolfBrandSuggestion,
  type GolfModelSuggestion,
} from "./golf-equipment-reference";

const brands: GolfBrandSuggestion[] = [
  { id: "titleist", name: "Titleist", slug: "titleist" },
  { id: "tm", name: "TaylorMade", slug: "taylormade" },
];
const models: GolfModelSuggestion[] = [
  {
    id: "gt3",
    brandId: "titleist",
    categoryId: "driver",
    name: "GT3",
    normalizedName: "gt3",
  },
  {
    id: "gt2",
    brandId: "titleist",
    categoryId: "driver",
    name: "GT2",
    normalizedName: "gt2",
  },
];

describe("shared golf equipment identity", () => {
  it("normalizes brand aliases and model spacing", () => {
    expect(normalizeGolfReference("Taylor Made")).toBe("taylormade");
    expect(resolveGolfBrand(brands, "Taylor Made").canonical?.name).toBe(
      "TaylorMade",
    );
    expect(
      resolveGolfModel(models, "GT 3", "titleist", "driver").canonical?.name,
    ).toBe("GT3");
  });

  it("does not silently resolve ambiguous or missing identities", () => {
    expect(resolveGolfModel(models, "GT", "titleist", "driver").status).toBe(
      "AMBIGUOUS",
    );
    expect(resolveGolfBrand(brands, "Unknown").status).toBe("NOT_FOUND");
  });

  it("keeps shared resolution independent of Mi Golf", () => {
    const result = normalizeGolfEquipmentIdentity({
      brand: "TITLEIST",
      model: "GT 3",
      brands,
      models,
      categoryId: "driver",
    });
    expect(result.status).toBe("RESOLVED");
    expect(result.brand.canonical?.id).toBe("titleist");
  });

  it("supports a non-mutating backfill report", () => {
    const report = dryRunGolfIdentityBackfill(
      [
        { brand: "Titleist", model: "GT3" },
        { brand: "New", model: "Mystery" },
      ],
      brands,
      models,
    );
    expect(report.counts.EXACT_MATCH).toBe(1);
    expect(report.counts.NOT_FOUND).toBe(1);
    expect(report.unresolved).toHaveLength(1);
  });
});
