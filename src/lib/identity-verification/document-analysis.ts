import { z } from "zod";

import type { PartnerLegalType } from "@/lib/marketplace/partner-rules";

export const automaticReviewResultSchema = z.enum([
  "PASSED",
  "REVIEW_REQUIRED",
  "FAILED",
]);

export type AutomaticReviewResult = z.infer<typeof automaticReviewResultSchema>;

export const acceptedAddressProofTypes = [
  "electricity",
  "water",
  "gas",
  "fixed_internet_or_telephone",
  "bank_statement",
] as const;

export type AddressProofInput = {
  legalType: PartnerLegalType;
  documentType: string | null;
  documentDate: Date | null;
  partnerName: string;
  documentName: string | null;
  addressConsistent: boolean | null;
  now: Date;
};

export function normalizeDocumentValue(value: string | null) {
  return value
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

export function analyzeAddressProof(input: AddressProofInput): {
  result: AutomaticReviewResult;
  warningCodes: string[];
} {
  const warnings: string[] = [];
  if (!input.documentType) {
    return {
      result: "REVIEW_REQUIRED",
      warningCodes: ["DOCUMENT_TYPE_NOT_EXTRACTED"],
    };
  }
  if (
    !acceptedAddressProofTypes.includes(
      input.documentType as (typeof acceptedAddressProofTypes)[number],
    )
  ) {
    return { result: "FAILED", warningCodes: ["UNSUPPORTED_DOCUMENT_TYPE"] };
  }
  if (!input.documentDate) {
    warnings.push("DOCUMENT_DATE_NOT_EXTRACTED");
  } else {
    const ageMs = input.now.getTime() - input.documentDate.getTime();
    if (ageMs < 0 || ageMs > 93 * 24 * 60 * 60 * 1000) {
      return { result: "FAILED", warningCodes: ["ADDRESS_PROOF_TOO_OLD"] };
    }
  }
  if (input.addressConsistent === false) {
    return { result: "FAILED", warningCodes: ["ADDRESS_MISMATCH"] };
  }
  if (input.addressConsistent === null)
    warnings.push("ADDRESS_MATCH_UNCERTAIN");
  const nameMatches =
    normalizeDocumentValue(input.partnerName) ===
    normalizeDocumentValue(input.documentName);
  if (!nameMatches) {
    warnings.push("ACCOUNT_HOLDER_NAME_MISMATCH");
    if (input.legalType !== "LEGAL_ENTITY") {
      return { result: "REVIEW_REQUIRED", warningCodes: warnings };
    }
  }
  return {
    result: warnings.length ? "REVIEW_REQUIRED" : "PASSED",
    warningCodes: warnings,
  };
}

export function analyzeFiscalCertificate(input: {
  registeredRfc: string | null;
  registeredName: string | null;
  documentRfc: string | null;
  documentName: string | null;
  qrOfficialRfc: string | null;
  qrDestinationIsOfficial: boolean;
  qrWarningCode?: string;
}): { result: AutomaticReviewResult; warningCodes: string[] } {
  if (!input.documentRfc || !input.documentName) {
    return {
      result: "REVIEW_REQUIRED",
      warningCodes: ["CSF_EXTRACTION_INCOMPLETE"],
    };
  }
  if (!input.registeredRfc || !input.registeredName) {
    return {
      result: "REVIEW_REQUIRED",
      warningCodes: ["REGISTERED_FISCAL_DATA_INCOMPLETE"],
    };
  }
  if (
    normalizeDocumentValue(input.registeredRfc) !==
    normalizeDocumentValue(input.documentRfc)
  ) {
    return { result: "FAILED", warningCodes: ["RFC_MISMATCH"] };
  }
  if (
    normalizeDocumentValue(input.registeredName) !==
    normalizeDocumentValue(input.documentName)
  ) {
    return { result: "FAILED", warningCodes: ["FISCAL_NAME_MISMATCH"] };
  }
  if (!input.qrDestinationIsOfficial) {
    return {
      result: "REVIEW_REQUIRED",
      warningCodes: [input.qrWarningCode ?? "SAT_QR_NOT_VERIFIED"],
    };
  }
  if (!input.qrOfficialRfc) {
    return {
      result: "REVIEW_REQUIRED",
      warningCodes: ["SAT_QR_RFC_NOT_EXTRACTED"],
    };
  }
  if (
    normalizeDocumentValue(input.qrOfficialRfc) !==
    normalizeDocumentValue(input.documentRfc)
  ) {
    return { result: "FAILED", warningCodes: ["SAT_QR_RFC_MISMATCH"] };
  }
  return { result: "PASSED", warningCodes: [] };
}

export function analyzeIncorporationDocument(input: {
  legalNameExtracted: boolean;
  incorporationDateExtracted: boolean;
  representativeAuthorityConfirmed: boolean;
}): { result: AutomaticReviewResult; warningCodes: string[] } {
  const warnings: string[] = [];
  if (!input.legalNameExtracted) warnings.push("LEGAL_NAME_NOT_EXTRACTED");
  if (!input.incorporationDateExtracted)
    warnings.push("INCORPORATION_DATE_NOT_EXTRACTED");
  if (!input.representativeAuthorityConfirmed)
    warnings.push("REPRESENTATIVE_AUTHORITY_REVIEW_REQUIRED");
  return {
    result: warnings.length ? "REVIEW_REQUIRED" : "PASSED",
    warningCodes: warnings,
  };
}

export function requiredPartnerDocuments(input: {
  legalType: PartnerLegalType;
  countryCode: string | null;
}) {
  if (input.legalType === "LEGAL_ENTITY") {
    return [
      "incorporation_deed",
      "company_address_proof",
      "fiscal_certificate",
      "legal_representative_id",
    ] as const;
  }
  if (input.legalType === "SOLE_PROPRIETOR") {
    return input.countryCode === "MX"
      ? (["address_proof", "fiscal_certificate"] as const)
      : ([
          "address_proof",
          "fiscal_certificate",
          "immigration_document",
        ] as const);
  }
  return input.countryCode === "MX"
    ? (["address_proof"] as const)
    : (["address_proof", "immigration_document"] as const);
}
