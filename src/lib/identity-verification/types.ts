export type IdentityVerificationKind = "PERSON" | "BUSINESS";
export type NormalizedIdentityResult =
  "PENDING" | "PASSED" | "REVIEW_REQUIRED" | "FAILED";

export type IdentitySessionRequest = {
  partnerId: string;
  kind: IdentityVerificationKind;
  callbackUrl: string;
  email?: string | null;
  phone?: string | null;
};

export type IdentitySession = {
  provider: string;
  externalSessionId: string;
  verificationUrl: string;
  status: NormalizedIdentityResult;
};

export type IdentityWebhookResult = {
  eventId: string;
  externalSessionId: string;
  occurredAt: string;
  result: NormalizedIdentityResult;
  attributes: Record<string, string | boolean>;
  warningCodes: string[];
};

export interface IdentityVerificationProvider {
  readonly name: string;
  createSession(request: IdentitySessionRequest): Promise<IdentitySession>;
  verifyAndNormalizeWebhook(input: {
    rawBody: string;
    headers: Headers;
    now?: Date;
  }): IdentityWebhookResult;
}
