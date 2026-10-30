import { describe, expect, test } from "vitest";
import { canEditBulkRow, deriveBulkJobAggregate, getPricingAfterManualModelApproval, hasBulkModelIdentityChanged, isBulkRowRetryReady } from "./row-execution-policy";

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
      pricingResult: { status: "COMPETITIVE", proposedPriceMinor: 150000, economics: { publicPriceMinor: 150000, partnerNetMinor: 140000, commissionMinor: 1000, commissionVatMinor: 160, processingTotalMinor: 500, adminPercentageFeeMinor: 100, adminFixedFeeMinor: 100, estimatedBestRoundRevenueMinor: 500, meetsMinimumMarketplaceRevenue: true } },
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
    expect(isBulkRowRetryReady({ ...base, manualResolution: { model: { approved: true, brand: "Cobra", model: "QA Manual Test X", category: "driver", modelYear: 2024 } } })).toBe(true);
  });

  test.each(["FIRST_PARTY", "PARTNER"] as const)("approving Row B's unchanged manual identity preserves %s pricing exactly", (importType) => {
    const previousPayload = { brand: "Cobra", model: "QA Manual Test X", category: "driver", modelYear: 2024 };
    const pricing = importType === "FIRST_PARTY"
      ? { financialPriceMinor: 1_597_822, approvedPriceMinor: 1_650_000, proposedPriceMinor: 1_650_000, manualPriceApproved: true, humanReviewStatus: "APPROVED", belowFinancialFloor: false, stale: false }
      : { approvedPriceMinor: 1_650_000, calculatedPublicPriceMinor: 1_650_000, estimatedPartnerNetMinor: 1_400_000, economics: { partnerNetMinor: 1_400_000 }, manualPriceApproved: true, humanReviewStatus: "APPROVED", marketStatus: "COMPETITIVE", stale: false };
    const result = getPricingAfterManualModelApproval({ importType, previousPayload, approvedPayload: { ...previousPayload }, currentPricing: pricing });

    if (importType === "PARTNER") expect(result).toBe(pricing);
    expect(result).toStrictEqual(importType === "FIRST_PARTY" ? { ...pricing, belowFinancialFloor: false, financialFloorOverrideApproved: false } : pricing);
  });

  test.each(["FIRST_PARTY", "PARTNER"] as const)("semantic identity normalization preserves %s pricing", (importType) => {
    const pricing = { approvedPriceMinor: 1_650_000, manualPriceApproved: true, stale: false };
    const result = getPricingAfterManualModelApproval({
      importType,
      previousPayload: { brand: "Cobra", model: "QA Manual Test X", category: "driver", modelYear: 2024 },
      approvedPayload: { brand: " cobra ", model: " QA Manual Test X ", category: "DRIVER", modelYear: "2024" },
      currentPricing: pricing,
    });

    if (importType === "PARTNER") expect(result).toBe(pricing);
    else expect(result).toStrictEqual({ ...pricing, belowFinancialFloor: false, financialFloorOverrideApproved: false });
  });

  test("a real First Party identity change invalidates only First Party pricing state", () => {
    const result = getPricingAfterManualModelApproval({
      importType: "FIRST_PARTY",
      previousPayload: { brand: "Cobra", model: "QA Manual Test X", category: "driver", modelYear: 2024 },
      approvedPayload: { brand: "Cobra", model: "QA Manual Test Y", category: "driver", modelYear: 2024 },
      currentPricing: { financialPriceMinor: 1_597_822, approvedPriceMinor: 1_650_000, proposedPriceMinor: 1_650_000, belowFinancialFloor: false, manualPriceApproved: true, humanReviewStatus: "APPROVED", stale: false },
    });

    expect(result).toMatchObject({ financialPriceMinor: 1_597_822, approvedPriceMinor: null, proposedPriceMinor: null, calculatedPublicPriceMinor: null, manualPriceApproved: false, humanReviewStatus: null, stale: true });
    expect(result).not.toHaveProperty("estimatedPartnerNetMinor");
    expect(result).not.toHaveProperty("economics");
  });

  test("a real Partner identity change invalidates only Marketplace pricing state", () => {
    const result = getPricingAfterManualModelApproval({
      importType: "PARTNER",
      previousPayload: { brand: "Cobra", model: "QA Manual Test X", category: "driver", modelYear: 2024 },
      approvedPayload: { brand: "Titleist", model: "QA Manual Test X", category: "driver", modelYear: 2024 },
      currentPricing: { approvedPriceMinor: 1_650_000, calculatedPublicPriceMinor: 1_650_000, estimatedPartnerNetMinor: 1_400_000, economics: { partnerNetMinor: 1_400_000 }, manualPriceApproved: true, humanReviewStatus: "APPROVED", marketStatus: "COMPETITIVE", stale: false },
    });

    expect(result).toMatchObject({ approvedPriceMinor: null, calculatedPublicPriceMinor: null, estimatedPartnerNetMinor: null, economics: null, marketStatus: "INSUFFICIENT_DATA", manualPriceApproved: false, humanReviewStatus: null, stale: true });
    expect(result).not.toHaveProperty("financialPriceMinor");
    expect(result).not.toHaveProperty("belowFinancialFloor");
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

  test.each(["PARTNER", "FIRST_PARTY"])("excluded failed rows do not block an imported aggregate for %s", () => {
    expect(deriveBulkJobAggregate([
      { execution_status: "IMPORTED" },
      { execution_status: "SKIPPED_EXISTING" },
      { execution_status: "FAILED", excluded: true },
    ])).toEqual({ imported: 1, skipped: 1, failed: 0, status: "IMPORTED" });
  });
});
