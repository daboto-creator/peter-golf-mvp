import { describe, expect, it } from "vitest";

import {
  generateTaxonomySlug,
  selectAssignableTaxonomies,
  taxonomySlugConflictMessage,
  validateBrandForm,
  validateCategoryForm,
  wouldCreateCategoryCycle,
} from "@/lib/catalog/taxonomy-validation";

const validBrand = {
  name: "Titleist",
  slug: "titleist",
  description: "Equipo de golf",
  status: "active" as const,
};

describe("taxonomy validation", () => {
  it("validates and trims brand names and slugs", () => {
    expect(validateBrandForm({ ...validBrand, name: " Titleist " })).toEqual({
      success: true,
      data: validBrand,
    });
    expect(validateBrandForm({ ...validBrand, name: "" }).success).toBe(false);
    expect(validateBrandForm({ ...validBrand, slug: "Bad/Slug" }).success).toBe(
      false,
    );
    expect(generateTaxonomySlug("  Línea Ápex 21 ")).toBe("linea-apex-21");
  });

  it("accepts only schema catalog statuses", () => {
    expect(validateBrandForm(validBrand).success).toBe(true);
    expect(
      validateBrandForm({ ...validBrand, status: "disabled" }).success,
    ).toBe(false);
  });

  it("validates sort order and parent ids", () => {
    const base = {
      ...validBrand,
      parentId: "",
      sortOrder: "0",
    };
    expect(validateCategoryForm(base)).toMatchObject({
      success: true,
      data: { parentId: null, sortOrder: 0 },
    });
    expect(validateCategoryForm({ ...base, sortOrder: "-1" }).success).toBe(
      false,
    );
    expect(validateCategoryForm({ ...base, sortOrder: "1.5" }).success).toBe(
      false,
    );
    expect(validateCategoryForm({ ...base, parentId: "unsafe" }).success).toBe(
      false,
    );
  });
});

describe("category hierarchy", () => {
  const categories = [
    { id: "a", parentId: null },
    { id: "b", parentId: "a" },
    { id: "c", parentId: "b" },
  ];

  it("prevents self-parenting and descendant cycles", () => {
    expect(wouldCreateCategoryCycle("a", "a", categories)).toBe(true);
    expect(wouldCreateCategoryCycle("a", "c", categories)).toBe(true);
    expect(wouldCreateCategoryCycle("c", "a", categories)).toBe(false);
  });
});

describe("product taxonomy selection", () => {
  const records = [
    { id: "active", name: "Activa", status: "active" as const },
    { id: "archived", name: "Archivada", status: "archived" as const },
  ];

  it("offers only active records for new assignments", () => {
    expect(selectAssignableTaxonomies(records)).toEqual([records[0]]);
  });

  it("keeps the current archived relation while editing", () => {
    expect(selectAssignableTaxonomies(records, "archived")).toEqual(records);
  });

  it("returns clear conflict messages", () => {
    expect(taxonomySlugConflictMessage("brand")).toContain("marca");
    expect(taxonomySlugConflictMessage("category")).toContain("categoría");
  });
});
