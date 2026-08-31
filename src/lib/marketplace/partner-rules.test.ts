import { describe, expect, it } from "vitest";

import {
  basicPartnerSchema,
  getNextExperienceMode,
  getOnboardingCompletion,
  isPartnerReadOnly,
  legalTypeCopy,
  normalizePartnerMode,
  partnerDocumentPath,
  partnerStatusCopy,
  validateFiscalInformation,
  validatePartnerDocument,
  validatePartnerDocumentSignature,
} from "./partner-rules";

describe("Partner onboarding rules", () => {
  it("maps every backend status and legal type to friendly UI copy", () => {
    expect(Object.keys(partnerStatusCopy)).toHaveLength(6);
    expect(legalTypeCopy.LEGAL_ENTITY.label).toBe("Persona Moral");
  });

  it("validates person and company basic profiles", () => {
    expect(
      basicPartnerSchema.safeParse({
        first_name: "Ana",
        last_name: "Golf",
        phone: "5512345678",
        country_code: "MX",
        state: "CDMX",
        city: "CDMX",
        commercial_name: "",
        representative_name: "",
      }).success,
    ).toBe(true);
    expect(
      basicPartnerSchema.safeParse({
        first_name: "",
        last_name: "",
        phone: "",
        country_code: "MX",
        state: "",
        city: "",
        commercial_name: "",
        representative_name: "",
      }).success,
    ).toBe(false);
  });

  it("requires fiscal data only for commercial Partner types", () => {
    const empty = {
      tax_id: null,
      legal_name: null,
      fiscal_address_line_1: null,
      fiscal_address_line_2: null,
      fiscal_city: null,
      fiscal_state: null,
      fiscal_postal_code: null,
    };
    expect(validateFiscalInformation("INDIVIDUAL", empty)).toBeNull();
    expect(validateFiscalInformation("SOLE_PROPRIETOR", empty)).not.toBeNull();
  });

  it("validates document metadata, signature and opaque paths", () => {
    const file = {
      name: "identificacion.pdf",
      type: "application/pdf",
      size: 1024,
    };
    expect(validatePartnerDocument(file)).toBeNull();
    expect(
      validatePartnerDocumentSignature(
        file.type,
        new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      ),
    ).toBe(true);
    expect(
      partnerDocumentPath(
        "8af784ab-1574-4f2d-bf55-10be67991738",
        "b5b614d4-7185-4485-9122-24e267cecd9a",
        file.type,
      ),
    ).toBe(
      "partners/8af784ab-1574-4f2d-bf55-10be67991738/b5b614d4-7185-4485-9122-24e267cecd9a.pdf",
    );
    expect(
      validatePartnerDocument({
        name: "documento.exe",
        type: "application/octet-stream",
        size: 100,
      }),
    ).not.toBeNull();
    expect(
      validatePartnerDocument({
        name: "documento.pdf",
        type: "application/pdf",
        size: 10 * 1024 * 1024 + 1,
      }),
    ).not.toBeNull();
  });

  it("keeps mode as UX context and locks final/review states", () => {
    expect(normalizePartnerMode("partner")).toBe("partner");
    expect(normalizePartnerMode("unexpected")).toBe("golfer");
    expect(isPartnerReadOnly("UNDER_REVIEW")).toBe(true);
    expect(isPartnerReadOnly("IDENTITY_PENDING")).toBe(false);
    expect(getNextExperienceMode("golfer")).toBe("partner");
  });

  it("derives onboarding progress only from real readiness criteria", () => {
    expect(
      getOnboardingCompletion({
        basic_complete: true,
        fiscal_complete: true,
        documents_complete: false,
        review_ready: false,
      }),
    ).toEqual({ completed: 2, total: 4, percentage: 50 });
  });
});
