import { describe, expect, it } from "vitest";

import {
  generateTaxonomySlug,
  groupProductCategoryOptions,
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

  it("groups canonical golf leaves by parent and preserves sibling order", () => {
    const active = "active" as const;
    const records = [
      {
        id: "stand",
        name: "Stand Bag",
        status: active,
        parentId: "bags",
        sortOrder: 20,
      },
      {
        id: "sets",
        name: "Golf Club Sets",
        status: active,
        parentId: null,
        sortOrder: 110,
        hasChildren: true,
      },
      {
        id: "driver",
        name: "Driver",
        status: active,
        parentId: "clubs",
        sortOrder: 10,
      },
      {
        id: "accessories",
        name: "Accesorios",
        status: active,
        parentId: null,
        sortOrder: 30,
      },
      {
        id: "clubs",
        name: "Golf Clubs",
        status: active,
        parentId: null,
        sortOrder: 100,
        hasChildren: true,
      },
      {
        id: "complete",
        name: "Complete Set",
        status: active,
        parentId: "sets",
        sortOrder: 10,
      },
      {
        id: "bags",
        name: "Golf Bags",
        status: active,
        parentId: null,
        sortOrder: 120,
        hasChildren: true,
      },
      {
        id: "wedge",
        name: "Wedge",
        status: active,
        parentId: "clubs",
        sortOrder: 50,
      },
      {
        id: "cart",
        name: "Cart Bag",
        status: active,
        parentId: "bags",
        sortOrder: 10,
      },
      {
        id: "iron-set",
        name: "Iron Set",
        status: active,
        parentId: "sets",
        sortOrder: 20,
      },
    ];

    const groups = groupProductCategoryOptions(records);

    expect(
      groups.map((group) => ({
        label: group.label,
        options: group.options.map((option) => option.name),
      })),
    ).toEqual([
      { label: "Golf Clubs", options: ["Driver", "Wedge"] },
      { label: "Golf Club Sets", options: ["Complete Set", "Iron Set"] },
      { label: "Golf Bags", options: ["Cart Bag", "Stand Bag"] },
      { label: "Otras categorías", options: ["Accesorios"] },
    ]);
    expect(groups.flatMap((group) => group.options)).not.toContainEqual(
      expect.objectContaining({ id: "clubs" }),
    );
  });

  it("keeps a currently assigned parent available only as a legacy relation", () => {
    const active = "active" as const;
    const records = [
      {
        id: "clubs",
        name: "Golf Clubs",
        status: active,
        parentId: null,
        sortOrder: 100,
        hasChildren: true,
      },
      {
        id: "driver",
        name: "Driver",
        status: active,
        parentId: "clubs",
        sortOrder: 10,
      },
    ];

    const groups = groupProductCategoryOptions(records, "clubs");

    expect(groups[0]).toMatchObject({
      label: "Relación actual",
      currentRelationOnly: true,
      options: [{ id: "clubs" }],
    });
    expect(groups[1]).toMatchObject({
      label: "Golf Clubs",
      options: [{ id: "driver" }],
    });
  });
});
