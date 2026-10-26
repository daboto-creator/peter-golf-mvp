import { describe, expect, test } from "vitest";
import { canApproveBulkImport, deriveFirstPartyFinancialFloorState, getDisplayedReviewedPriceMinor, getFirstPartyBulkPricingReadiness, getPartnerBulkPricingReadiness, normalizeFirstPartyPricingState, shouldRecalculateFirstPartyPricing, shouldRecalculatePartnerPricing } from "./review-policy";
import { reconcileCurrentRowState } from "./review-reconciliation";
import { hasBulkAcquisitionCostChanged } from "./row-execution-policy";

describe("bulk import review approval", () => {
  const partnerEconomics = (publicPriceMinor: number, partnerNetMinor = Math.max(1, publicPriceMinor - 10_000)) => ({ publicPriceMinor, partnerNetMinor, commissionMinor: 1_000, commissionVatMinor: 160, processingTotalMinor: 500, adminPercentageFeeMinor: 100, adminFixedFeeMinor: 100, estimatedBestRoundRevenueMinor: 500, meetsMinimumMarketplaceRevenue: true });
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
    expect(canApproveBulkImport([{ ...ready, pricing_result: { status: "INSUFFICIENT_DATA", proposedPriceMinor: 150000, manualPriceApproved: true, humanReviewStatus: "APPROVED" } }], { importType: "FIRST_PARTY" })).toMatchObject({ allowed: true });
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
  test("Partner approval requires a current actionable price but never cost", () => {
    const partner = { severity: "READY", normalized_payload: {}, pricing_result: { status: "COMPETITIVE", proposedPriceMinor: 250000, economics: partnerEconomics(250000) } };
    expect(getPartnerBulkPricingReadiness(partner).ready).toBe(true);
    expect(canApproveBulkImport([{ severity: "READY", normalized_payload: {}, pricing_result: { status: "INSUFFICIENT_DATA", proposedPriceMinor: 250000 } }], { importType: "PARTNER" })).toMatchObject({ allowed: false, code: "PRICING_REVIEW_REQUIRED" });
    expect(canApproveBulkImport([partner], { importType: "PARTNER" })).toMatchObject({ allowed: true });
  });
  test("Partner manual price with no market reference stays honest and can proceed", () => {
    const result = getPartnerBulkPricingReadiness({ normalized_payload: {}, pricing_result: { status: "INSUFFICIENT_DATA", proposedPriceMinor: 250000, estimatedPartnerNetMinor: 240000, economics: partnerEconomics(250000, 240000), manualPriceApproved: true, humanReviewStatus: "APPROVED" } });
    expect(result).toMatchObject({ ready: true, warning: true, label: "Precio listo · mercado limitado" });
    const reconciled = reconcileCurrentRowState({ importType: "PARTNER", normalizedPayload: { category: "fairway-wood" }, pricingResult: { status: "INSUFFICIENT_DATA", proposedPriceMinor: 250000, estimatedPartnerNetMinor: 240000, economics: partnerEconomics(250000, 240000), manualPriceApproved: true, humanReviewStatus: "APPROVED" }, existingIssues: [] });
    expect(reconciled.severity).toBe("WARNING");
    expect(reconciled.issues.some((issue) => issue.code === "MISSING_ACQUISITION_COST")).toBe(false);
  });
  test("Partner manual pricing needs both durable approval fields", () => {
    const economics = partnerEconomics(250000, 240000);
    expect(getPartnerBulkPricingReadiness({ pricing_result: { status: "INSUFFICIENT_DATA", proposedPriceMinor: 250000, economics, manualPriceApproved: true } }).ready).toBe(false);
    expect(getPartnerBulkPricingReadiness({ pricing_result: { status: "INSUFFICIENT_DATA", proposedPriceMinor: 250000, economics, humanReviewStatus: "APPROVED" } }).ready).toBe(false);
  });
  test("Partner with neither public price nor desired net is blocking", () => {
    const result = reconcileCurrentRowState({ importType: "PARTNER", normalizedPayload: { category: "fairway-wood" }, pricingResult: { status: "INSUFFICIENT_DATA" }, existingIssues: [] });
    expect(result.severity).toBe("ERROR");
    expect(result.issues[0]?.message).toContain("precio público o un neto deseado");
  });
  test("Partner economics do not inherit the First Party financial floor", () => {
    const result = getPartnerBulkPricingReadiness({ normalized_payload: {}, pricing_result: { status: "INSUFFICIENT_DATA", approvedPriceMinor: 950000, manualPriceApproved: true, humanReviewStatus: "APPROVED", stale: false, financialPriceMinor: 1016909, economics: { publicPriceMinor: 950000, partnerNetMinor: 800000, commissionMinor: 0, commissionVatMinor: 0, processingTotalMinor: 0, adminPercentageFeeMinor: 0, adminFixedFeeMinor: 0, estimatedBestRoundRevenueMinor: 1 } } });
    expect(result.ready).toBe(true);
  });
  test("same Partner public price still recalculates unresolved pricing", () => {
    expect(shouldRecalculatePartnerPricing({ pricingSubmitted: true, priceChanged: false, desiredNetChanged: false, normalizedPayload: { askingPriceMinor: 1051000 }, pricingResult: { status: "INSUFFICIENT_DATA", humanReviewStatus: "APPROVED", manualPriceApproved: false, approvedPriceMinor: 1004435, calculatedPublicPriceMinor: 1004435, stale: false } })).toBe(true);
  });
  test("same desired Partner net still recalculates unresolved pricing", () => {
    expect(shouldRecalculatePartnerPricing({ pricingSubmitted: true, priceChanged: false, desiredNetChanged: false, normalizedPayload: { askingPriceMinor: 1051000, desiredNetMinor: 800000 }, pricingResult: { status: "INSUFFICIENT_DATA", humanReviewStatus: "APPROVED", manualPriceApproved: false, approvedPriceMinor: 1004435, stale: false } })).toBe(true);
  });
  test("already-ready unchanged Partner pricing is a no-op", () => {
    expect(shouldRecalculatePartnerPricing({ pricingSubmitted: true, priceChanged: false, desiredNetChanged: false, normalizedPayload: { askingPriceMinor: 1051000 }, pricingResult: { status: "COMPETITIVE", humanReviewStatus: "APPROVED", manualPriceApproved: true, approvedPriceMinor: 1051000, economics: partnerEconomics(1051000), stale: false } })).toBe(false);
  });
  test("same First Party sale price can be approved without a fake change", () => {
    expect(shouldRecalculateFirstPartyPricing({ pricingSubmitted: true, normalizedPayload: { askingPriceMinor: 834000, acquisitionCostMinor: 500000 }, pricingResult: { status: "INSUFFICIENT_DATA", proposedPriceMinor: null, manualPriceApproved: false, stale: false }, costChanged: false })).toBe(true);
  });
  test("prefilled unchanged acquisition cost is not treated as a change", () => {
    expect(hasBulkAcquisitionCostChanged(800000, 800000)).toBe(false);
  });
  test("a numerically changed acquisition cost is detected", () => {
    expect(hasBulkAcquisitionCostChanged(800000, 810000)).toBe(true);
  });
  test("same First Party cost and price reapprove unresolved pricing", () => {
    expect(shouldRecalculateFirstPartyPricing({ pricingSubmitted: true, normalizedPayload: { askingPriceMinor: 1250000, acquisitionCostMinor: 800000 }, pricingResult: { status: "INSUFFICIENT_DATA", stale: true, manualPriceApproved: false }, costChanged: false })).toBe(true);
  });
  test("changed First Party cost with submitted price reapproves in one save", () => {
    expect(shouldRecalculateFirstPartyPricing({ pricingSubmitted: true, normalizedPayload: { askingPriceMinor: 1190000, acquisitionCostMinor: 1000000 }, pricingResult: { status: "INSUFFICIENT_DATA", stale: true, manualPriceApproved: false }, costChanged: true })).toBe(true);
  });
  test("ready First Party pricing with unchanged values is a no-op", () => {
    expect(shouldRecalculateFirstPartyPricing({ pricingSubmitted: true, normalizedPayload: { askingPriceMinor: 1250000, acquisitionCostMinor: 800000 }, pricingResult: { status: "COMPETITIVE", proposedPriceMinor: 1250000, approvedPriceMinor: 1250000, manualPriceApproved: true, humanReviewStatus: "APPROVED", stale: false }, costChanged: false })).toBe(false);
  });
  test("First Party below-floor pricing is a blocking financial error", () => {
    const result = getFirstPartyBulkPricingReadiness({ normalized_payload: { acquisitionCostMinor: 700000 }, pricing_result: { status: "INSUFFICIENT_DATA", approvedPriceMinor: 950000, financialPriceMinor: 1016909, manualPriceApproved: true, humanReviewStatus: "APPROVED", stale: false } });
    expect(result).toMatchObject({ ready: false, code: "BELOW_FINANCIAL_FLOOR" });
    expect(result.message).toContain("mínimo financiero");
  });
  test("manualOverride alone never authorizes a First Party floor bypass", () => {
    expect(getFirstPartyBulkPricingReadiness({ normalized_payload: { acquisitionCostMinor: 700000 }, pricing_result: { status: "INSUFFICIENT_DATA", approvedPriceMinor: 950000, financialPriceMinor: 1016909, manualPriceApproved: true, humanReviewStatus: "APPROVED", manualOverride: true, stale: false } })).toMatchObject({ ready: false, code: "BELOW_FINANCIAL_FLOOR" });
  });
  test("an explicit reviewed floor override requires a reason", () => {
    const base = { status: "INSUFFICIENT_DATA", approvedPriceMinor: 950000, financialPriceMinor: 1016909, manualPriceApproved: true, humanReviewStatus: "APPROVED", financialFloorOverrideApproved: true, stale: false };
    expect(getFirstPartyBulkPricingReadiness({ normalized_payload: { acquisitionCostMinor: 700000 }, pricing_result: base })).toMatchObject({ ready: false, code: "BELOW_FINANCIAL_FLOOR" });
    expect(getFirstPartyBulkPricingReadiness({ normalized_payload: { acquisitionCostMinor: 700000 }, pricing_result: { ...base, manualPriceReason: "Autorización financiera documentada" } })).toMatchObject({ ready: true, code: "READY" });
  });
  test("derives and normalizes historical First Party floor metadata", () => {
    const pricing = { approvedPriceMinor: 1_650_000, proposedPriceMinor: 1_500_000, calculatedPublicPriceMinor: 1_400_000, financialPriceMinor: 1_597_822, belowFinancialFloor: true, financialFloorOverrideApproved: true };
    expect(deriveFirstPartyFinancialFloorState(pricing)).toMatchObject({ effectivePriceMinor: 1_650_000, financialPriceMinor: 1_597_822, belowFinancialFloor: false });
    expect(normalizeFirstPartyPricingState(pricing)).toMatchObject({ belowFinancialFloor: false, financialFloorOverrideApproved: false });
  });
  test("First Party readiness derives the floor from current amounts, not a stale persisted flag", () => {
    const result = getFirstPartyBulkPricingReadiness({ normalized_payload: { acquisitionCostMinor: 1_100_000 }, pricing_result: { status: "INSUFFICIENT_DATA", approvedPriceMinor: 1_650_000, financialPriceMinor: 1_597_822, belowFinancialFloor: true, manualPriceApproved: true, humanReviewStatus: "APPROVED", stale: false } });
    expect(result).toMatchObject({ ready: true, code: "READY" });
  });
  test("First Party approved manual model is durable while unresolved models require approval", () => {
    const approved = reconcileCurrentRowState({ importType: "FIRST_PARTY", normalizedPayload: { category: "driver", brand: "Cobra", model: "QA Manual Test X", modelYear: 2024, acquisitionCostMinor: 700000 }, pricingResult: { status: "COMPETITIVE", proposedPriceMinor: 150000 }, existingIssues: [], manualResolution: { model: { approved: true, brand: "Cobra", model: "QA Manual Test X", category: "driver", modelYear: 2024 } } });
    expect(approved.issues.some((issue) => issue.code === "MANUAL_MODEL_APPROVAL_REQUIRED")).toBe(false);
    const unresolved = reconcileCurrentRowState({ importType: "FIRST_PARTY", normalizedPayload: { category: "driver", model: "QA Manual Test X", acquisitionCostMinor: 700000 }, pricingResult: { status: "COMPETITIVE", proposedPriceMinor: 150000 }, existingIssues: [] });
    expect(unresolved.issues.some((issue) => issue.code === "MANUAL_MODEL_APPROVAL_REQUIRED")).toBe(true);
  });
  test("canonical model presence with a null model year does not require manual approval", () => {
    const result = reconcileCurrentRowState({ importType: "FIRST_PARTY", normalizedPayload: { category: "driver", brand: "Cobra", model: "Canonical yearless", acquisitionCostMinor: 700000 }, pricingResult: { status: "COMPETITIVE", proposedPriceMinor: 150000 }, existingIssues: [], canonicalModelId: "canonical-model-id", canonicalModelYear: null });
    expect(result.issues.some((issue) => issue.code === "MANUAL_MODEL_APPROVAL_REQUIRED")).toBe(false);
  });
  test("mismatched durable manual approval remains blocking", () => {
    const result = reconcileCurrentRowState({ importType: "FIRST_PARTY", normalizedPayload: { category: "driver", brand: "Cobra", model: "QA Manual Test X", modelYear: 2024, acquisitionCostMinor: 700000 }, pricingResult: { status: "COMPETITIVE", proposedPriceMinor: 150000 }, existingIssues: [], manualResolution: { model: { approved: true, brand: "Cobra", model: "QA Manual Test Y", category: "driver", modelYear: 2024 } } });
    expect(result.issues.some((issue) => issue.code === "MANUAL_MODEL_APPROVAL_REQUIRED")).toBe(true);
  });
  test("manual approval with a stale category remains blocking", () => {
    const result = reconcileCurrentRowState({ importType: "PARTNER", normalizedPayload: { category: "driver", brand: "Cobra", model: "QA Manual Test X", modelYear: 2024 }, pricingResult: { status: "COMPETITIVE", proposedPriceMinor: 150000, economics: partnerEconomics(150000) }, existingIssues: [], manualResolution: { model: { approved: true, brand: "Cobra", model: "QA Manual Test X", category: "fairway-wood", modelYear: 2024 } } });
    expect(result.issues.some((issue) => issue.code === "MANUAL_MODEL_APPROVAL_REQUIRED")).toBe(true);
  });
  test("display uses approved/calculated value before proposed or input", () => {
    expect(getDisplayedReviewedPriceMinor({ proposedPriceMinor: null, approvedPriceMinor: 1004435, calculatedPublicPriceMinor: 1004435 }, { askingPriceMinor: 1051000 })).toBe(1004435);
  });
  test.each(["PARTNER", "FIRST_PARTY"] as const)("approved manual model clears stale catalog errors for %s", (importType) => {
    const result = reconcileCurrentRowState({
      importType,
      normalizedPayload: { category: "driver", brand: "Cobra", model: "DarkSpeed X", modelYear: 2024, acquisitionCostMinor: importType === "FIRST_PARTY" ? 100000 : undefined },
      pricingResult: importType === "FIRST_PARTY" ? { status: "COMPETITIVE", proposedPriceMinor: 150000 } : { status: "COMPETITIVE", proposedPriceMinor: 150000, economics: partnerEconomics(150000) },
      existingIssues: [{ code: "UNKNOWN_MODEL", severity: "ERROR", field: "model", message: "old" }],
      manualResolution: { model: { approved: true, brand: "Cobra", model: "DarkSpeed X", category: "driver", modelYear: 2024 } },
    });
    expect(result.issues.some((issue) => issue.code === "UNKNOWN_MODEL")).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "MANUAL_MODEL_APPROVED", severity: "INFO" }));
    expect(result.severity).toBe("READY");
  });
  test("unresolved model still blocks when no manual fallback is approved", () => {
    const result = reconcileCurrentRowState({ importType: "PARTNER", normalizedPayload: { category: "driver" }, pricingResult: { status: "COMPETITIVE", proposedPriceMinor: 150000 }, existingIssues: [{ code: "UNKNOWN_MODEL", severity: "ERROR", field: "model", message: "old" }] });
    expect(result.severity).toBe("ERROR");
    expect(result.issues.some((issue) => issue.code === "UNKNOWN_MODEL")).toBe(true);
  });
});
