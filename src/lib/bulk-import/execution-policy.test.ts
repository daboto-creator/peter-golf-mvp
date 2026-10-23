import { describe, expect, it } from "vitest";
import { canExecuteFirstPartyBulkImport, canExecutePartnerBulkImport } from "./execution-policy";

const base = { importType: "FIRST_PARTY" as const, status: "APPROVED_FOR_IMPORT" as const, isOperator: true, importableRows: 1, hasBlockingErrors: false };

describe("first party bulk execution policy", () => {
  it("allows an approved operations job", () => expect(canExecuteFirstPartyBulkImport(base)).toEqual({ allowed: true }));
  it("rejects review and partner jobs", () => {
    expect(canExecuteFirstPartyBulkImport({ ...base, status: "READY_FOR_REVIEW" })).toMatchObject({ allowed: false, code: "INVALID_STATE" });
    expect(canExecuteFirstPartyBulkImport({ ...base, importType: "PARTNER" })).toMatchObject({ allowed: false, code: "PARTNER_NOT_SUPPORTED" });
  });
  it("rejects unauthorized, empty, and blocking jobs", () => {
    expect(canExecuteFirstPartyBulkImport({ ...base, isOperator: false })).toMatchObject({ allowed: false, code: "UNAUTHORIZED" });
    expect(canExecuteFirstPartyBulkImport({ ...base, importableRows: 0 })).toMatchObject({ allowed: false, code: "NO_ROWS" });
    expect(canExecuteFirstPartyBulkImport({ ...base, hasBlockingErrors: true })).toMatchObject({ allowed: false, code: "BLOCKING_ERRORS" });
  });
});

describe("partner bulk execution policy", () => {
  const partner = { importType: "PARTNER" as const, status: "APPROVED_FOR_IMPORT" as const, isOperator: true, partnerProfileId: "partner-1", importableRows: 1, hasBlockingErrors: false, pricingReady: true };
  it("allows an approved Partner job without acquisition cost", () => expect(canExecutePartnerBulkImport(partner)).toEqual({ allowed: true }));
  it("rejects First Party, missing ownership, stale pricing and unsafe states", () => {
    expect(canExecutePartnerBulkImport({ ...partner, importType: "FIRST_PARTY" })).toMatchObject({ allowed: false, code: "FIRST_PARTY_NOT_SUPPORTED" });
    expect(canExecutePartnerBulkImport({ ...partner, partnerProfileId: null })).toMatchObject({ allowed: false, code: "MISSING_PARTNER" });
    expect(canExecutePartnerBulkImport({ ...partner, pricingReady: false })).toMatchObject({ allowed: false, code: "PRICING_REVIEW_REQUIRED" });
    expect(canExecutePartnerBulkImport({ ...partner, status: "READY_FOR_REVIEW" })).toMatchObject({ allowed: false, code: "INVALID_STATE" });
  });
});
