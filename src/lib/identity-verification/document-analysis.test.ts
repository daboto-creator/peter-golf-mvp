import { describe, expect, it } from "vitest";

import {
  analyzeAddressProof,
  analyzeFiscalCertificate,
  analyzeIncorporationDocument,
  requiredPartnerDocuments,
} from "@/lib/identity-verification/document-analysis";

describe("rules-first Partner document analysis", () => {
  const now = new Date("2026-08-30T12:00:00Z");

  it("rejects an address proof older than three months", () => {
    expect(
      analyzeAddressProof({
        legalType: "INDIVIDUAL",
        documentType: "water",
        documentDate: new Date("2026-04-01T00:00:00Z"),
        partnerName: "Ana Golf",
        documentName: "Ana Golf",
        addressConsistent: true,
        now,
      }),
    ).toEqual({ result: "FAILED", warningCodes: ["ADDRESS_PROOF_TOO_OLD"] });
  });

  it("keeps an unclassified provider in Operations review", () => {
    expect(
      analyzeAddressProof({
        legalType: "INDIVIDUAL",
        documentType: null,
        documentDate: new Date("2026-08-20T00:00:00Z"),
        partnerName: "Ana Golf",
        documentName: "Ana Golf",
        addressConsistent: true,
        now,
      }),
    ).toEqual({
      result: "REVIEW_REQUIRED",
      warningCodes: ["DOCUMENT_TYPE_NOT_EXTRACTED"],
    });
  });

  it("fails a clear postal-code mismatch", () => {
    expect(
      analyzeAddressProof({
        legalType: "INDIVIDUAL",
        documentType: "electricity",
        documentDate: new Date("2026-08-20T00:00:00Z"),
        partnerName: "Ana Golf",
        documentName: "Ana Golf",
        addressConsistent: false,
        now,
      }),
    ).toEqual({ result: "FAILED", warningCodes: ["ADDRESS_MISMATCH"] });
  });

  it("warns but does not reject a company account-holder name mismatch", () => {
    expect(
      analyzeAddressProof({
        legalType: "LEGAL_ENTITY",
        documentType: "bank_statement",
        documentDate: new Date("2026-08-01T00:00:00Z"),
        partnerName: "Golf Ejemplo SA de CV",
        documentName: "Arrendadora Ejemplo",
        addressConsistent: true,
        now,
      }),
    ).toEqual({
      result: "REVIEW_REQUIRED",
      warningCodes: ["ACCOUNT_HOLDER_NAME_MISMATCH"],
    });
  });

  it("fails a CSF RFC mismatch without using an unofficial SAT API", () => {
    expect(
      analyzeFiscalCertificate({
        registeredRfc: "GEX260101AA1",
        registeredName: "Golf Ejemplo",
        documentRfc: "OTR260101AA1",
        documentName: "Golf Ejemplo",
        qrOfficialRfc: null,
        qrDestinationIsOfficial: false,
      }).warningCodes,
    ).toContain("RFC_MISMATCH");
  });

  it("routes uncertain legal authority to review", () => {
    expect(
      analyzeIncorporationDocument({
        legalNameExtracted: true,
        incorporationDateExtracted: true,
        representativeAuthorityConfirmed: false,
      }).result,
    ).toBe("REVIEW_REQUIRED");
  });

  it("requires immigration evidence for a foreign individual", () => {
    expect(
      requiredPartnerDocuments({
        legalType: "INDIVIDUAL",
        countryCode: "US",
      }),
    ).toContain("immigration_document");
  });

  it("keeps Particular onboarding free of RFC requirements", () => {
    expect(
      requiredPartnerDocuments({
        legalType: "INDIVIDUAL",
        countryCode: "MX",
      }),
    ).toEqual(["address_proof"]);
  });

  it("requires CSF for Persona Física", () => {
    expect(
      requiredPartnerDocuments({
        legalType: "SOLE_PROPRIETOR",
        countryCode: "MX",
      }),
    ).toEqual(["address_proof", "fiscal_certificate"]);
  });

  it("uses the corporate document package for Persona Moral", () => {
    expect(
      requiredPartnerDocuments({
        legalType: "LEGAL_ENTITY",
        countryCode: "MX",
      }),
    ).toEqual([
      "incorporation_deed",
      "company_address_proof",
      "fiscal_certificate",
      "legal_representative_id",
    ]);
  });
});
