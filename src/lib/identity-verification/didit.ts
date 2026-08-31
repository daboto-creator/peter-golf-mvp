import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import type {
  IdentitySession,
  IdentitySessionRequest,
  IdentityVerificationProvider,
  IdentityWebhookResult,
  NormalizedIdentityResult,
} from "@/lib/identity-verification/types";

const sessionResponseSchema = z.object({
  session_id: z.uuid(),
  url: z.url(),
});

const featureSchema = z.object({
  status: z.string(),
  document_type: z.string().optional(),
  issuing_state: z.string().optional(),
  issuing_country: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
});

const webhookSchema = z.object({
  event_id: z.uuid(),
  session_id: z.uuid(),
  timestamp: z.number().int().positive(),
  status: z.string(),
  webhook_type: z.enum(["status.updated", "data.updated"]),
  decision: z
    .object({
      id_verifications: z.array(featureSchema).default([]),
      liveness_checks: z.array(featureSchema).default([]),
      face_matches: z.array(featureSchema).default([]),
      warnings: z
        .array(z.union([z.string(), z.object({ code: z.string() })]))
        .optional(),
    })
    .optional(),
});

type DiditConfig = {
  apiBaseUrl: string;
  apiKey: string;
  kycWorkflowId: string;
  kybWorkflowId: string;
  webhookSecret: string;
};

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, sortKeys(entry)]),
    );
  }
  return value;
}

function safeEqual(expected: string, actual: string | null) {
  if (!actual) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  return left.length === right.length && timingSafeEqual(left, right);
}

function featurePassed(status: string | undefined) {
  return status?.toLowerCase() === "approved";
}

function normalizeStatus(status: string): NormalizedIdentityResult {
  switch (status.toLowerCase()) {
    case "approved":
      return "PASSED";
    case "declined":
    case "abandoned":
    case "expired":
    case "kyc expired":
      return "FAILED";
    case "in review":
    case "resubmitted":
      return "REVIEW_REQUIRED";
    default:
      return "PENDING";
  }
}

export class DiditIdentityVerificationProvider implements IdentityVerificationProvider {
  readonly name = "DIDIT";

  constructor(private readonly config: DiditConfig) {}

  async createSession(
    request: IdentitySessionRequest,
  ): Promise<IdentitySession> {
    const workflowId =
      request.kind === "BUSINESS"
        ? this.config.kybWorkflowId
        : this.config.kycWorkflowId;
    const response = await fetch(`${this.config.apiBaseUrl}/v3/session/`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.config.apiKey,
      },
      body: JSON.stringify({
        workflow_id: workflowId,
        vendor_data: request.partnerId,
        callback: request.callbackUrl,
        callback_method: "both",
        language: "es",
        contact_details: {
          email: request.email || undefined,
          phone: request.phone || undefined,
          send_notification_emails: false,
        },
        metadata: { source: "best-round-partner-onboarding" },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Identity provider session failed.");
    const parsed = sessionResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("Identity provider response invalid.");
    return {
      provider: this.name,
      externalSessionId: parsed.data.session_id,
      verificationUrl: parsed.data.url,
      status: "PENDING",
    };
  }

  verifyAndNormalizeWebhook(input: {
    rawBody: string;
    headers: Headers;
    now?: Date;
  }): IdentityWebhookResult {
    const payload: unknown = JSON.parse(input.rawBody);
    const parsed = webhookSchema.parse(payload);
    const headerTimestamp = Number(input.headers.get("x-timestamp"));
    const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
    if (
      !Number.isInteger(headerTimestamp) ||
      headerTimestamp !== parsed.timestamp ||
      Math.abs(nowSeconds - headerTimestamp) > 300
    ) {
      throw new Error("Identity webhook timestamp invalid.");
    }
    const canonical = JSON.stringify(sortKeys(payload));
    const signatureV2 = createHmac("sha256", this.config.webhookSecret)
      .update(canonical, "utf8")
      .digest("hex");
    const rawSignature = createHmac("sha256", this.config.webhookSecret)
      .update(input.rawBody, "utf8")
      .digest("hex");
    if (
      !safeEqual(signatureV2, input.headers.get("x-signature-v2")) &&
      !safeEqual(rawSignature, input.headers.get("x-signature"))
    ) {
      throw new Error("Identity webhook signature invalid.");
    }
    const identity = parsed.decision?.id_verifications[0];
    const liveness = parsed.decision?.liveness_checks[0];
    const faceMatch = parsed.decision?.face_matches[0];
    const warnings = (parsed.decision?.warnings ?? []).map((warning) =>
      typeof warning === "string" ? warning : warning.code,
    );
    return {
      eventId: parsed.event_id,
      externalSessionId: parsed.session_id,
      occurredAt: new Date(parsed.timestamp * 1000).toISOString(),
      result: normalizeStatus(parsed.status),
      attributes: Object.fromEntries(
        Object.entries({
          documentType: identity?.document_type,
          issuingCountry: identity?.issuing_country ?? identity?.issuing_state,
          firstName: identity?.first_name,
          lastName: identity?.last_name,
          livenessPassed: featurePassed(liveness?.status),
          faceMatchPassed: featurePassed(faceMatch?.status),
        }).filter(
          (entry): entry is [string, string | boolean] =>
            entry[1] !== undefined,
        ),
      ),
      warningCodes: [...new Set(warnings)].slice(0, 50),
    };
  }
}
