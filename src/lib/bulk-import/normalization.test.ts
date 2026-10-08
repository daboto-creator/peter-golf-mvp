import { describe, expect, it } from "vitest";
import { buildBulkPreview } from "./preview";
import { parseSpanishCsv, exportErrorCsv } from "./csv";
import { normalizeBrand, normalizeCategory, normalizeHand, normalizeFlex, normalizeShaftMaterial, parseMoneyToMinorUnits, normalizePhotoKey } from "./normalization";
import type { CatalogModelReference } from "./types";

const models: CatalogModelReference[] = [
  { id: "p790-21", brandId: "tm", brandName: "TaylorMade", brandSlug: "taylormade", categoryId: "iron", categoryName: "Hierros", categorySlug: "iron", modelName: "P790", normalizedModelName: "p790", modelYear: 2021 },
  { id: "p790-23", brandId: "tm", brandName: "TaylorMade", brandSlug: "taylormade", categoryId: "iron", categoryName: "Hierros", categorySlug: "iron", modelName: "P790", normalizedModelName: "p790", modelYear: 2023 },
  { id: "gt3", brandId: "titleist", brandName: "Titleist", brandSlug: "titleist", categoryId: "driver", categoryName: "Driver", categorySlug: "driver", modelName: "GT3", normalizedModelName: "gt3", modelYear: 2024 },
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

  it("normalizes photo keys and protects formula exports", () => {
    expect(normalizePhotoKey("GT3 001")).toBe("gt3-001");
    expect(exportErrorCsv([{ Fila: 2, "ID externo": "=HYPERLINK(\"x\")", Estado: "Error", Código: "X", Problema: "No" }])).toContain("'=HYPERLINK");
  });
});
