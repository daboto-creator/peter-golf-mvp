import { describe, expect, test } from "vitest";
import { canEditBulkRow, deriveBulkJobAggregate, getFirstPartyPricingAfterManualModelApproval, hasBulkModelIdentityChanged, isBulkRowRetryReady } from "./row-execution-policy";

describe("bulk row remediation policy", () => {
  test("only failed rows are editable after a partial import", () => {
    expect(canEditBulkRow("PARTIALLY_IMPORTED", "FAILED")).toBe(true);
    expect(canEditBulkRow("PARTIALLY_IMPORTED", "IMPORTED")).toBe(false);
    expect(canEditBulkRow("PARTIALLY_IMPORTED", "SKIPPED_EXISTING")).toBe(false);
  });

  test("pending rows remain editable during review", () => {
    expect(canEditBulkRow("READY_FOR_REVIEW", "PENDING_IMPORT")).toBe(true);
    expect(canEditBulkRow("READY_FOR_REVIEW", undefined)).toBe(true);
  });

  test("failed rows become retry-ready only after current blockers clear", () => {
    const base = {
      jobStatus: "PARTIALLY_IMPORTED",
      executionStatus: "FAILED",
      importType: "PARTNER" as const,
      normalizedPayload: { category: "driver" },
      pricingResult: { status: "COMPETITIVE", proposedPriceMinor: 150000 },
      existingIssues: [],
    };
    expect(isBulkRowRetryReady({ ...base, existingIssues: [{ code: "UNKNOWN_MODEL", severity: "ERROR", message: "missing" }] })).toBe(false);
    expect(isBulkRowRetryReady(base)).toBe(true);
  });

  test("imported rows can never be retry-ready", () => {
    expect(isBulkRowRetryReady({
      jobStatus: "PARTIALLY_IMPORTED",
      executionStatus: "IMPORTED",
      importType: "PARTNER",
      normalizedPayload: { category: "driver" },
      pricingResult: { status: "COMPETITIVE", proposedPriceMinor: 150000 },
      existingIssues: [],
    })).toBe(false);
  });

  test("First Party retry readiness requires pricing and durable manual model approval independently", () => {
    const base = {
      jobStatus: "PARTIALLY_IMPORTED",
      executionStatus: "FAILED",
      importType: "FIRST_PARTY" as const,
      normalizedPayload: { category: "driver", brand: "Cobra", model: "QA Manual Test X", modelYear: 2024, acquisitionCostMinor: 1_100_000 },
      pricingResult: { status: "INSUFFICIENT_DATA", financialPriceMinor: 1_597_822, approvedPriceMinor: 1_650_000, proposedPriceMinor: 1_650_000, belowFinancialFloor: false, manualPriceApproved: true, humanReviewStatus: "APPROVED", stale: false },
      existingIssues: [],
      canonicalModelYear: null,
    };

    expect(isBulkRowRetryReady(base)).toBe(false);
    expect(isBulkRowRetryReady({ ...base, manualResolution: { model: { approved: true, brand: "Cobra", model: "QA Manual Test X", modelYear: 2024 } } })).toBe(true);
  });

  test("approving the unchanged manual model preserves successful pricing", () => {
    const payload = { category: "driver", brand: "Cobra", model: "QA Manual Test X", modelYear: 2024 };
    const pricing = { approvedPriceMinor: 1_650_000, manualPriceApproved: true, humanReviewStatus: "APPROVED", stale: false };
    const invalidated = { approvedPriceMinor: null, manualPriceApproved: false, stale: true };

    expect(getFirstPartyPricingAfterManualModelApproval({ previousPayload: payload, approvedPayload: { ...payload }, currentPricing: pricing, invalidatedPricing: invalidated })).toBe(pricing);
    expect(getFirstPartyPricingAfterManualModelApproval({ previousPayload: payload, approvedPayload: { ...payload, model: "Different model" }, currentPricing: pricing, invalidatedPricing: invalidated })).toBe(invalidated);
  });

  test.each(["PARTNER", "FIRST_PARTY"])("model identity changes invalidate manual fallback for %s", () => {
    const previous = { brand: "Cobra", model: "DarkSpeed X", category: "driver", modelYear: 2024 };
    expect(hasBulkModelIdentityChanged(previous, { ...previous, brand: "TaylorMade" })).toBe(true);
    expect(hasBulkModelIdentityChanged(previous, { ...previous, model: "Qi35" })).toBe(true);
    expect(hasBulkModelIdentityChanged(previous, { ...previous, category: "hybrid" })).toBe(true);
    expect(hasBulkModelIdentityChanged(previous, { ...previous, modelYear: 2025 })).toBe(true);
    expect(hasBulkModelIdentityChanged(previous, { ...previous, brand: " cobra ", model: "darkspeed x" })).toBe(false);
  });

  test.each(["PARTNER", "FIRST_PARTY"])("aggregate counters include prior imported rows for %s", () => {
    expect(deriveBulkJobAggregate([
      { execution_status: "IMPORTED" }, { execution_status: "IMPORTED" },
      { execution_status: "IMPORTED" }, { execution_status: "IMPORTED" },
      { execution_status: "FAILED" },
    ])).toEqual({ imported: 4, skipped: 0, failed: 1, status: "PARTIALLY_IMPORTED" });
    expect(deriveBulkJobAggregate([
      { execution_status: "IMPORTED" }, { execution_status: "IMPORTED" },
      { execution_status: "IMPORTED" }, { execution_status: "IMPORTED" },
      { execution_status: "IMPORTED" },
    ])).toEqual({ imported: 5, skipped: 0, failed: 0, status: "IMPORTED" });
  });
});
