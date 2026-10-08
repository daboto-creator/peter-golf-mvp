import { describe, expect, test } from "vitest";
import { canApproveBulkImport } from "./review-policy";

describe("bulk import review approval", () => {
  test("approves included valid rows", () => expect(canApproveBulkImport([{ severity: "READY" }, { severity: "WARNING" }])).toMatchObject({ allowed: true, includedCount: 2 }));
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
});
