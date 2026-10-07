import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type NormalizedModel = {
  brand: string;
  category: string;
  model: string;
  modelYear: number | null;
  sourceStatus: string;
};

const curatedBrands = new Set([
  "Adams Golf", "Ben Hogan Golf", "Bridgestone Golf", "Callaway",
  "Cleveland Golf", "Cobra", "Honma", "Mizuno", "Odyssey", "PING",
  "PXG", "Scotty Cameron", "Srixon", "Sub 70", "TaylorMade", "Titleist",
  "Tour Edge", "Wilson Staff",
]);

describe("normalized golf catalog artifact", () => {
  const models = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "docs/catalog/golf-models-normalized.json"), "utf8"),
  ) as NormalizedModel[];

  it("contains only curated brands and valid generation years", () => {
    expect(models.length).toBeGreaterThan(500);
    expect(models.every((model) => curatedBrands.has(model.brand))).toBe(true);
    expect(models.every((model) => model.model.trim().length > 0)).toBe(true);
    expect(models.every((model) => model.modelYear === null || (model.modelYear >= 2020 && model.modelYear <= 2026))).toBe(true);
    expect(models.some((model) => model.brand === "TaylorMade" && model.model === "SIM" && model.modelYear === 2020)).toBe(true);
    expect(models.some((model) => model.brand === "Titleist" && model.model === "Vokey SM10" && model.modelYear === 2024)).toBe(true);
  });

  it("does not include generic placeholder model names", () => {
    expect(models.some((model) => /varios|standard|custom|series$/i.test(model.model))).toBe(false);
  });
});
