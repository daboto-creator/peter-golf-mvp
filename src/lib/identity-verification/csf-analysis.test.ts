import { describe, expect, it } from "vitest";

import {
  csfPartnerMessage,
  extractCsfDataFromText,
  finalizeCsfAnalysis,
  inspectSatQrPayload,
} from "@/lib/identity-verification/csf-analysis";

const physicalRfc = "TEXA900101AB1";
const companyRfc = "TEX900101AB1";
const satQr = (rfc: string) =>
  `https://siat.sat.gob.mx/app/qr/faces/pages/mobile/validadorqr.jsf?D1=10&D2=1&D3=100000_${rfc}`;

describe("automatic CSF analysis", () => {
  it("extracts and validates a matching Persona Física CSF", () => {
    const extracted = extractCsfDataFromText(
      `CÉDULA DE IDENTIFICACIÓN FISCAL\nRFC: ${physicalRfc}\nNombre (s): ANA MARIA\nPrimer Apellido: PRUEBA\nSegundo Apellido: SINTETICA`,
      "SOLE_PROPRIETOR",
    );
    expect(
      finalizeCsfAnalysis({
        registeredRfc: physicalRfc,
        registeredName: "Ana María Prueba Sintética",
        extracted,
        qr: { status: "DECODED", payload: satQr(physicalRfc) },
      }),
    ).toMatchObject({
      result: "PASSED",
      extractedRfc: physicalRfc,
      qrStatus: "VERIFIED",
      rfcMatches: true,
      nameMatches: true,
    });
  });

  it("extracts and validates a matching Persona Moral CSF", () => {
    const extracted = extractCsfDataFromText(
      `CONSTANCIA DE SITUACIÓN FISCAL\nRFC: ${companyRfc}\nDenominación/Razón Social: EQUIPO SINTETICO DE GOLF SA DE CV`,
      "LEGAL_ENTITY",
    );
    expect(
      finalizeCsfAnalysis({
        registeredRfc: companyRfc,
        registeredName: "Equipo Sintético de Golf, S.A. de C.V.",
        extracted,
        qr: { status: "DECODED", payload: satQr(companyRfc) },
      }).result,
    ).toBe("PASSED");
  });

  it("fails a clear RFC mismatch", () => {
    expect(
      finalizeCsfAnalysis({
        registeredRfc: physicalRfc,
        registeredName: "Ana Prueba",
        extracted: { rfc: "OTRA900101AB1", name: "Ana Prueba" },
        qr: { status: "DECODED", payload: satQr("OTRA900101AB1") },
      }),
    ).toMatchObject({ result: "FAILED", warningCodes: ["RFC_MISMATCH"] });
  });

  it("fails a clear fiscal name mismatch", () => {
    expect(
      finalizeCsfAnalysis({
        registeredRfc: companyRfc,
        registeredName: "Empresa Sintética",
        extracted: { rfc: companyRfc, name: "Nombre Diferente" },
        qr: { status: "DECODED", payload: satQr(companyRfc) },
      }),
    ).toMatchObject({
      result: "FAILED",
      warningCodes: ["FISCAL_NAME_MISMATCH"],
    });
  });

  it("accepts only the exact HTTPS SAT validator destination", () => {
    expect(inspectSatQrPayload(satQr(physicalRfc))).toMatchObject({
      official: true,
      rfc: physicalRfc,
    });
    expect(
      inspectSatQrPayload(
        `https://evil.example/redirect?next=${encodeURIComponent(satQr(physicalRfc))}`,
      ),
    ).toEqual({ official: false, destination: null, rfc: null });
    expect(
      inspectSatQrPayload(
        `https://siat.sat.gob.mx.evil.example/app/qr/faces/pages/mobile/validadorqr.jsf?D3=${physicalRfc}`,
      ).official,
    ).toBe(false);
  });

  it.each([
    ["MISSING", "NOT_AVAILABLE", "SAT_QR_MISSING"],
    ["UNREADABLE", "NOT_VERIFIED", "SAT_QR_UNREADABLE"],
  ] as const)(
    "routes a %s QR to human review without rejecting onboarding",
    (status, qrStatus, warning) => {
      expect(
        finalizeCsfAnalysis({
          registeredRfc: physicalRfc,
          registeredName: "Ana Prueba",
          extracted: { rfc: physicalRfc, name: "Ana Prueba" },
          qr: { status },
        }),
      ).toMatchObject({
        result: "REVIEW_REQUIRED",
        qrStatus,
        warningCodes: [warning],
      });
    },
  );

  it("routes a decoded non-SAT destination to review", () => {
    expect(
      finalizeCsfAnalysis({
        registeredRfc: physicalRfc,
        registeredName: "Ana Prueba",
        extracted: { rfc: physicalRfc, name: "Ana Prueba" },
        qr: { status: "DECODED", payload: "https://example.test/csf" },
      }),
    ).toMatchObject({
      result: "REVIEW_REQUIRED",
      qrStatus: "NOT_VERIFIED",
      warningCodes: ["SAT_QR_DESTINATION_NOT_OFFICIAL"],
    });
  });

  it("routes incomplete extraction to review", () => {
    expect(
      finalizeCsfAnalysis({
        registeredRfc: physicalRfc,
        registeredName: "Ana Prueba",
        extracted: { rfc: null, name: null },
        qr: { status: "MISSING" },
      }).result,
    ).toBe("REVIEW_REQUIRED");
  });

  it("waits for registered fiscal data instead of reporting a false mismatch", () => {
    expect(
      finalizeCsfAnalysis({
        registeredRfc: null,
        registeredName: null,
        extracted: { rfc: physicalRfc, name: "Ana Prueba" },
        qr: { status: "DECODED", payload: satQr(physicalRfc) },
      }),
    ).toMatchObject({
      result: "REVIEW_REQUIRED",
      warningCodes: ["REGISTERED_FISCAL_DATA_INCOMPLETE"],
    });
  });

  it("does not convert document PASSED into Partner VERIFIED", () => {
    const result = finalizeCsfAnalysis({
      registeredRfc: physicalRfc,
      registeredName: "Ana Prueba",
      extracted: { rfc: physicalRfc, name: "Ana Prueba" },
      qr: { status: "DECODED", payload: satQr(physicalRfc) },
    });
    expect(result).not.toHaveProperty("partnerStatus");
    expect(result.result).toBe("PASSED");
  });

  it("uses friendly Partner copy without exposing analysis codes", () => {
    expect(csfPartnerMessage("PASSED")).toBe(
      "Constancia validada correctamente.",
    );
    expect(csfPartnerMessage("REVIEW_REQUIRED")).not.toMatch(/CSF_|RFC_|SAT_/);
    expect(csfPartnerMessage("FAILED")).toContain("Encontramos una diferencia");
  });
});
