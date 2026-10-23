import { describe, expect, test } from "vitest";
import { canEditBulkRow, deriveBulkJobAggregate, hasBulkModelIdentityChanged, isBulkRowRetryReady } from "./row-execution-policy";

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
