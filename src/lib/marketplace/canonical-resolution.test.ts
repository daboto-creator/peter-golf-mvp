import { describe, expect, it } from "vitest";

import { canonicalResolutionConfidence } from "@/lib/marketplace/canonical-resolution";

const candidates = [
  { id: "one", brandName: "Titleist", modelName: "GT3" },
  { id: "two", brandName: "Titleist", modelName: "GT2 Driver" },
];

describe("canonical product resolution", () => {
  it("returns high confidence for an exact unique match", () => {
    expect(
      canonicalResolutionConfidence({
        canonicalModelId: null,
        proposedBrand: "titleist",
        proposedModel: "GT3",
        candidates,
      }).confidence,
    ).toBe("HIGH");
  });
  it("returns medium for a same-brand partial model", () => {
    expect(
      canonicalResolutionConfidence({
        canonicalModelId: null,
        proposedBrand: "Titleist",
        proposedModel: "GT2",
        candidates,
      }).confidence,
    ).toBe("MEDIUM");
  });
  it("returns low when no candidate is credible", () => {
    expect(
      canonicalResolutionConfidence({
        canonicalModelId: null,
        proposedBrand: "Otra",
        proposedModel: "X",
        candidates,
      }).confidence,
    ).toBe("LOW");
  });
});
