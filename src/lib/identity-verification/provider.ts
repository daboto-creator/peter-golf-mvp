import "server-only";

import { serverEnv } from "@/env/server";
import { DiditIdentityVerificationProvider } from "@/lib/identity-verification/didit";
import type { IdentityVerificationProvider } from "@/lib/identity-verification/types";

export function getIdentityVerificationProvider(): IdentityVerificationProvider | null {
  if (serverEnv.IDENTITY_VERIFICATION_PROVIDER !== "didit") return null;
  if (
    !serverEnv.DIDIT_API_KEY ||
    !serverEnv.DIDIT_KYC_WORKFLOW_ID ||
    !serverEnv.DIDIT_KYB_WORKFLOW_ID ||
    !serverEnv.DIDIT_WEBHOOK_SECRET
  ) {
    throw new Error("Identity provider configuration is incomplete.");
  }
  return new DiditIdentityVerificationProvider({
    apiBaseUrl: serverEnv.DIDIT_API_BASE_URL,
    apiKey: serverEnv.DIDIT_API_KEY,
    kycWorkflowId: serverEnv.DIDIT_KYC_WORKFLOW_ID,
    kybWorkflowId: serverEnv.DIDIT_KYB_WORKFLOW_ID,
    webhookSecret: serverEnv.DIDIT_WEBHOOK_SECRET,
  });
}
