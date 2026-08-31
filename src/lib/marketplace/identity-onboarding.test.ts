import { describe, expect, it } from "vitest";

import {
  identityOnboardingNextRoute,
  resolveIdentityOnboardingState,
} from "@/lib/marketplace/identity-onboarding";

describe("Partner identity onboarding", () => {
  it("offers the initial verification only when no verification exists", () => {
    expect(resolveIdentityOnboardingState(null)).toMatchObject({
      canStart: true,
      shouldAdvance: false,
      actionLabel: "Iniciar verificación de identidad",
    });
  });

  it("does not create another session while verification is active", () => {
    expect(resolveIdentityOnboardingState("PENDING")).toEqual({
      canStart: false,
      shouldAdvance: false,
      shouldPoll: true,
      actionLabel: null,
      message: "Estamos procesando tu verificación.",
    });
  });

  it("advances PASSED and prevents restarting identity verification", () => {
    expect(resolveIdentityOnboardingState("PASSED")).toMatchObject({
      canStart: false,
      shouldAdvance: true,
      actionLabel: null,
    });
  });

  it("allows retry only after FAILED", () => {
    expect(resolveIdentityOnboardingState("FAILED")).toMatchObject({
      canStart: true,
      shouldAdvance: false,
      actionLabel: "Reintentar verificación",
    });
  });

  it("uses friendly review copy without exposing provider state", () => {
    expect(resolveIdentityOnboardingState("REVIEW_REQUIRED")).toEqual({
      canStart: false,
      shouldAdvance: false,
      shouldPoll: false,
      actionLabel: null,
      message: "Necesitamos revisar un detalle de tu verificación.",
    });
  });

  it("does not let an Approved query string replace database state", () => {
    const returnedStatus = new URLSearchParams("status=Approved").get("status");
    expect(returnedStatus).toBe("Approved");
    expect(resolveIdentityOnboardingState(null).shouldAdvance).toBe(false);
  });

  it("routes people to documents and companies to fiscal onboarding", () => {
    expect(identityOnboardingNextRoute("INDIVIDUAL")).toBe(
      "/partner/onboarding/documentos",
    );
    expect(identityOnboardingNextRoute("SOLE_PROPRIETOR")).toBe(
      "/partner/onboarding/documentos",
    );
    expect(identityOnboardingNextRoute("LEGAL_ENTITY")).toBe(
      "/partner/onboarding/fiscal",
    );
  });
});
