import { describe, expect, test } from "vitest";
import { canEditBulkRow, isBulkRowRetryReady } from "./row-execution-policy";

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
});
