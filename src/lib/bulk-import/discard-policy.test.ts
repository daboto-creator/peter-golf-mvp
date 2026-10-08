import { describe, expect, test } from "vitest";
import { canDiscardBulkImportJob, bulkImportTemporaryArtifactPolicy } from "./discard-policy";

const base = { partnerProfileId: null };

describe("bulk import discard policy", () => {
  test("allows a non-imported completed preview for an operator", () => {
    expect(canDiscardBulkImportJob({ ...base, status: "READY_FOR_REVIEW" }, { isOperator: true })).toEqual({ allowed: true });
  });
  test("allows a partner to discard only its own job", () => {
    expect(canDiscardBulkImportJob({ status: "FAILED", partnerProfileId: "p1" }, { isOperator: false, partnerProfileId: "p1" })).toEqual({ allowed: true });
    const decision = canDiscardBulkImportJob({ status: "FAILED", partnerProfileId: "p1" }, { isOperator: false, partnerProfileId: "p2" });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("UNAUTHORIZED_JOB");
  });
  test("protects active processing and future imported jobs", () => {
    const processing = canDiscardBulkImportJob({ ...base, status: "ANALYZING_PRICING" }, { isOperator: true });
    const imported = canDiscardBulkImportJob({ ...base, status: "IMPORTED" }, { isOperator: true });
    expect(processing.allowed).toBe(false);
    expect(imported.allowed).toBe(false);
    if (!processing.allowed) expect(processing.code).toBe("JOB_PROCESSING");
    if (!imported.allowed) expect(imported.code).toBe("IMPORTED_JOB_PROTECTED");
    expect(canDiscardBulkImportJob({ ...base, status: "READY_FOR_REVIEW", finalDomainWriteState: "IMPORTED" }, { isOperator: true }).allowed).toBe(false);
  });
  test("documents that PR82 has no blob cleanup surface", () => {
    expect(bulkImportTemporaryArtifactPolicy).toMatchObject({ persistsBlobs: false, dynamicErrorCsv: true });
  });
});
