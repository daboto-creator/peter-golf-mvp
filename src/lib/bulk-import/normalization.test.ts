import { describe, expect, it } from "vitest";
import { buildBulkPreview } from "./preview";
import { parseSpanishCsv, exportErrorCsv } from "./csv";
import { normalizeBrand, normalizeCategory, normalizeHand, normalizeFlex, normalizeShaftMaterial, parseMoneyToMinorUnits, normalizePhotoKey } from "./normalization";
import type { CatalogModelReference } from "./types";

const models: CatalogModelReference[] = [
  { id: "p790-21", brandId: "tm", brandName: "TaylorMade", brandSlug: "taylormade", categoryId: "iron", categoryName: "Hierros", categorySlug: "iron", modelName: "P790", normalizedModelName: "p790", modelYear: 2021 },
  { id: "p790-23", brandId: "tm", brandName: "TaylorMade", brandSlug: "taylormade", categoryId: "iron", categoryName: "Hierros", categorySlug: "iron", modelName: "P790", normalizedModelName: "p790", modelYear: 2023 },
  { id: "gt3", brandId: "titleist", brandName: "Titleist", brandSlug: "titleist", categoryId: "driver", categoryName: "Driver", categorySlug: "driver", modelName: "GT3", normalizedModelName: "gt3", modelYear: 2024 },
  { id: "gt2-fw-24", brandId: "titleist", brandName: "Titleist", brandSlug: "titleist", categoryId: "fairway", categoryName: "Madera", categorySlug: "fairway-wood", modelName: "GT2 Fairway 5", normalizedModelName: "gt2 fairway 5", modelYear: 2024 },
  { id: "qi10-fw-24", brandId: "tm", brandName: "TaylorMade", brandSlug: "taylormade", categoryId: "fairway", categoryName: "Madera", categorySlug: "fairway-wood", modelName: "Qi10 Fairway 3", normalizedModelName: "qi10 fairway 3", modelYear: 2024 },
  { id: "gt2-fw-generic", brandId: "titleist", brandName: "Titleist", brandSlug: "titleist", categoryId: "fairway", categoryName: "Madera", categorySlug: "fairway-wood", modelName: "GT2", normalizedModelName: "gt2", modelYear: null },
  { id: "qi10-fw-generic", brandId: "tm", brandName: "TaylorMade", brandSlug: "taylormade", categoryId: "fairway", categoryName: "Madera", categorySlug: "fairway-wood", modelName: "Qi10", normalizedModelName: "qi10", modelYear: null },
];

describe("bulk import normalization", () => {
  it("normalizes curated labels and Spanish aliases", () => {
    expect(normalizeBrand(" TITLEIST ").value).toBe("Titleist");
    expect(normalizeBrand("Taylor Made").value).toBe("TaylorMade");
    expect(normalizeCategory("Madera de calle").value).toBe("fairway-wood");
    expect(normalizeHand("zurdo").value).toBe("LEFT");
    expect(normalizeFlex("Reg").value).toBe("REGULAR");
    expect(normalizeShaftMaterial("Grafito").value).toBe("GRAPHITE");
  });

  it("parses UTF-8 BOM and semicolon-delimited Spanish CSV", () => {
    const parsed = parseSpanishCsv("\uFEFFID externo;Categoría;Marca\nA-1;Driver;Titleist\n");
    expect(parsed.delimiter).toBe(";");
    expect(parsed.rows[0].values["ID externo"]).toBe("A-1");
  });

  it("keeps money conservative and handles explicit currency grouping", () => {
    expect(parseMoneyToMinorUnits("$10,500 MXN").value).toBe(1_050_000);
    expect(parseMoneyToMinorUnits("10.500").code).toBe("AMBIGUOUS_MONEY_FORMAT");
    expect(parseMoneyToMinorUnits("10500.00").value).toBe(1_050_000);
  });

  it("does not guess a repeated model generation", () => {
    const preview = buildBulkPreview({ csv: "ID externo,Categoría,Marca,Modelo,Año,Estado,Cantidad,Costo adquisición\nA-1,Hierros,TaylorMade,P790,,Usado,1,1000\n", importType: "FIRST_PARTY", models });
    expect(preview.rows[0].severity).toBe("ERROR");
    expect(preview.rows[0].issues.some((issue) => issue.code === "AMBIGUOUS_MODEL_GENERATION")).toBe(true);
  });

  it("resolves the supplied generation and keeps partner cost optional", () => {
    const preview = buildBulkPreview({ csv: "ID externo,Categoría,Marca,Modelo,Año,Estado,Cantidad,Precio solicitado\nA-1,Driver,Titleist,GT 3,2024,Usado,1,10500\n", importType: "PARTNER", models });
    expect(preview.rows[0].canonicalModelId).toBe("gt3");
    expect(preview.rows[0].issues.some((issue) => issue.code === "MISSING_ACQUISITION_COST")).toBe(false);
  });

  it("infers fairway category from a unique canonical model when the CSV category is blank", () => {
    const preview = buildBulkPreview({ csv: "ID externo,Categoría,Marca,Modelo,Año,Estado,Cantidad,Costo adquisición\nFW-1,,Titleist,GT2 Fairway 5,2024,Nuevo,1,1000\n", importType: "FIRST_PARTY", models });
    expect(preview.rows[0].normalized.categorySlug).toBe("fairway-wood");
    expect(preview.rows[0].canonicalModelId).toBe("gt2-fw-24");
    expect(preview.rows[0].fields.category.code).toBe("AUTO_CATEGORY_FROM_CANONICAL_MODEL");
    expect(preview.rows[0].issues.some((issue) => issue.code === "CATEGORY_REQUIRED")).toBe(false);
  });

  it("infers TaylorMade fairway category from the canonical model", () => {
    const preview = buildBulkPreview({ csv: "ID externo,Categoría,Marca,Modelo,Año,Estado,Cantidad,Costo adquisición\nFW-2,Madera,TaylorMade,Qi10 Fairway 3,2024,Nuevo,1,1000\n", importType: "FIRST_PARTY", models });
    expect(preview.rows[0].normalized.categorySlug).toBe("fairway-wood");
    expect(preview.rows[0].canonicalModelId).toBe("qi10-fw-24");
  });

  it("infers and resolves catalog models when the CSV includes a fairway variant suffix", () => {
    const preview = buildBulkPreview({ csv: "ID externo,Categoría,Marca,Modelo,Año,Estado,Cantidad,Costo adquisición\nFW-4,,Titleist,GT2 Fairway 5,2024,Nuevo,1,1000\n", importType: "FIRST_PARTY", models: models.filter((model) => model.id !== "gt2-fw-24") });
    expect(preview.rows[0].normalized.categorySlug).toBe("fairway-wood");
    expect(preview.rows[0].canonicalModelId).toBe("gt2-fw-generic");
  });

  it("blocks an explicit category that conflicts with the canonical model", () => {
    const preview = buildBulkPreview({ csv: "ID externo,Categoría,Marca,Modelo,Año,Estado,Cantidad,Costo adquisición\nFW-3,Driver,Titleist,GT2 Fairway 5,2024,Nuevo,1,1000\n", importType: "FIRST_PARTY", models });
    expect(preview.rows[0].issues.some((issue) => issue.code === "CATEGORY_MODEL_CONFLICT")).toBe(true);
    expect(preview.rows[0].severity).toBe("ERROR");
  });

  it("normalizes photo keys and protects formula exports", () => {
    expect(normalizePhotoKey("GT3 001")).toBe("gt3-001");
    expect(exportErrorCsv([{ Fila: 2, "ID externo": "=HYPERLINK(\"x\")", Estado: "Error", Código: "X", Problema: "No" }])).toContain("'=HYPERLINK");
  });
});
