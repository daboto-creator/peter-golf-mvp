import { describe, expect, test } from "vitest";
import { canApproveBulkImport, getFirstPartyBulkPricingReadiness } from "./review-policy";
import { reconcileCurrentRowState } from "./review-reconciliation";

describe("bulk import review approval", () => {
  const ready = { severity: "READY", normalized_payload: { acquisitionCostMinor: 100000 }, pricing_result: { status: "COMPETITIVE", proposedPriceMinor: 150000 } };
  test("approves included valid rows", () => expect(canApproveBulkImport([ready, { severity: "WARNING" }])).toMatchObject({ allowed: true, includedCount: 2 }));
  test("blocks included errors but allows excluded errors", () => {
    const blocked = canApproveBulkImport([{ severity: "ERROR" }]);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) expect(blocked.code).toBe("INCLUDED_ERRORS");
    expect(canApproveBulkImport([{ severity: "ERROR", excluded: true }, { severity: "READY" }])).toMatchObject({ allowed: true, includedCount: 1 });
  });
  test("requires at least one included row", () => {
    const blocked = canApproveBulkImport([{ severity: "ERROR", excluded: true }]);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) expect(blocked.code).toBe("NO_INCLUDED_ROWS");
  });
  test("blocks first party insufficient pricing and allows audited manual resolution", () => {
    expect(canApproveBulkImport([{ ...ready, pricing_result: { status: "INSUFFICIENT_DATA", proposedPriceMinor: 150000 } }], { importType: "FIRST_PARTY" })).toMatchObject({ allowed: false, code: "PRICING_REVIEW_REQUIRED" });
    expect(canApproveBulkImport([{ ...ready, pricing_result: { status: "INSUFFICIENT_DATA", proposedPriceMinor: 150000, manualPriceApproved: true } }], { importType: "FIRST_PARTY" })).toMatchObject({ allowed: true });
  });
  test("blocks canonical year mismatch and accepts a matching generation", () => {
    expect(canApproveBulkImport([{ ...ready, canonicalModelYear: 2022, normalizedModelYear: 2024 }], { importType: "FIRST_PARTY" })).toMatchObject({ allowed: false, code: "MODEL_YEAR_MISMATCH" });
    expect(canApproveBulkImport([{ ...ready, canonicalModelYear: 2022, normalizedModelYear: 2022 }], { importType: "FIRST_PARTY" })).toMatchObject({ allowed: true });
  });
  test("uses one pricing readiness result for resolved manual prices", () => {
    const row = { normalized_payload: { acquisitionCostMinor: 100000 }, pricing_result: { status: "COMPETITIVE", proposedPriceMinor: 834000, manualOverride: true } };
    expect(getFirstPartyBulkPricingReadiness(row).label).toBe("Precio listo");
    const result = reconcileCurrentRowState({ importType: "FIRST_PARTY", normalizedPayload: { category: "fairway-wood", acquisitionCostMinor: 100000 }, pricingResult: row.pricing_result, existingIssues: [{ code: "INSUFFICIENT_DATA", severity: "WARNING", message: "old" }] });
    expect(result.severity).toBe("READY");
    expect(result.issues.some((issue) => issue.code === "INSUFFICIENT_DATA")).toBe(false);
  });
  test("category is a blocker until reviewed", () => {
    const result = reconcileCurrentRowState({ importType: "FIRST_PARTY", normalizedPayload: { category: null, acquisitionCostMinor: 100000 }, pricingResult: { status: "COMPETITIVE", proposedPriceMinor: 100000 }, existingIssues: [] });
    expect(result.severity).toBe("ERROR");
    expect(result.issues[0]?.code).toBe("CATEGORY_REQUIRED");
  });
});
