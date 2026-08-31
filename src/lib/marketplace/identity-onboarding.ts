import type { Database } from "@/types/database.types";

import type { PartnerLegalType } from "@/lib/marketplace/partner-rules";

export type IdentityVerificationResult =
  Database["public"]["Enums"]["identity_verification_result"];

export type IdentityOnboardingState = {
  canStart: boolean;
  shouldAdvance: boolean;
  shouldPoll: boolean;
  actionLabel: string | null;
  message: string | null;
};

export function identityOnboardingNextRoute(
  legalType: PartnerLegalType,
): "/partner/onboarding/documentos" | "/partner/onboarding/fiscal" {
  return legalType === "LEGAL_ENTITY"
    ? "/partner/onboarding/fiscal"
    : "/partner/onboarding/documentos";
}

export function resolveIdentityOnboardingState(
  latestResult: IdentityVerificationResult | null | undefined,
): IdentityOnboardingState {
  if (latestResult === "PASSED") {
    return {
      canStart: false,
      shouldAdvance: true,
      shouldPoll: false,
      actionLabel: null,
      message: "Tu identidad fue validada correctamente.",
    };
  }
  if (latestResult === "PENDING") {
    return {
      canStart: false,
      shouldAdvance: false,
      shouldPoll: true,
      actionLabel: null,
      message: "Estamos procesando tu verificación.",
    };
  }
  if (latestResult === "REVIEW_REQUIRED") {
    return {
      canStart: false,
      shouldAdvance: false,
      shouldPoll: false,
      actionLabel: null,
      message: "Necesitamos revisar un detalle de tu verificación.",
    };
  }
  if (latestResult === "FAILED") {
    return {
      canStart: true,
      shouldAdvance: false,
      shouldPoll: false,
      actionLabel: "Reintentar verificación",
      message: "No pudimos completar tu verificación.",
    };
  }
  return {
    canStart: true,
    shouldAdvance: false,
    shouldPoll: false,
    actionLabel: "Iniciar verificación de identidad",
    message: null,
  };
}
