import { createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { DiditIdentityVerificationProvider } from "@/lib/identity-verification/didit";

const config = {
  apiBaseUrl: "https://verification.didit.example",
  apiKey: "didit-test-key",
  kycWorkflowId: "11111111-1111-4111-8111-111111111111",
  kybWorkflowId: "22222222-2222-4222-8222-222222222222",
  webhookSecret: "didit-webhook-test-secret",
};

describe("Didit identity provider", () => {
  it("creates a hosted person session without exposing credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          session_id: "33333333-3333-4333-8333-333333333333",
          url: "https://verify.didit.example/session/test",
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new DiditIdentityVerificationProvider(config);
    const session = await provider.createSession({
      partnerId: "44444444-4444-4444-8444-444444444444",
      kind: "PERSON",
      callbackUrl: "https://staging.example/partner/onboarding/identidad",
      email: "synthetic@example.test",
      phone: "+525500000000",
    });
    expect(session.status).toBe("PENDING");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://verification.didit.example/v3/session/",
      expect.objectContaining({
        headers: expect.objectContaining({ "x-api-key": "didit-test-key" }),
      }),
    );
    vi.unstubAllGlobals();
  });

  it("validates the signed webhook and requires liveness evidence", () => {
    const provider = new DiditIdentityVerificationProvider(config);
    const timestamp = 1_787_920_000;
    const payload = {
      event_id: "55555555-5555-4555-8555-555555555555",
      session_id: "33333333-3333-4333-8333-333333333333",
      timestamp,
      status: "Approved",
      webhook_type: "status.updated",
      decision: {
        id_verifications: [
          {
            status: "Approved",
            document_type: "Passport",
            issuing_country: "US",
          },
        ],
        liveness_checks: [{ status: "Approved" }],
        face_matches: [{ status: "Approved" }],
      },
    };
    const rawBody = JSON.stringify(payload);
    const signature = createHmac("sha256", config.webhookSecret)
      .update(rawBody)
      .digest("hex");
    const result = provider.verifyAndNormalizeWebhook({
      rawBody,
      headers: new Headers({
        "x-timestamp": String(timestamp),
        "x-signature": signature,
      }),
      now: new Date(timestamp * 1000),
    });
    expect(result).toMatchObject({
      result: "PASSED",
      attributes: {
        documentType: "Passport",
        issuingCountry: "US",
        livenessPassed: true,
        faceMatchPassed: true,
      },
    });
  });

  it("rejects an invalid signature", () => {
    const provider = new DiditIdentityVerificationProvider(config);
    const timestamp = 1_787_920_000;
    const rawBody = JSON.stringify({
      event_id: "55555555-5555-4555-8555-555555555555",
      session_id: "33333333-3333-4333-8333-333333333333",
      timestamp,
      status: "Approved",
      webhook_type: "status.updated",
    });
    expect(() =>
      provider.verifyAndNormalizeWebhook({
        rawBody,
        headers: new Headers({
          "x-timestamp": String(timestamp),
          "x-signature": "invalid",
        }),
        now: new Date(timestamp * 1000),
      }),
    ).toThrow("signature");
  });

  it("normalizes an expired provider session as failed", () => {
    const provider = new DiditIdentityVerificationProvider(config);
    const timestamp = 1_787_920_000;
    const rawBody = JSON.stringify({
      event_id: "55555555-5555-4555-8555-555555555556",
      session_id: "33333333-3333-4333-8333-333333333333",
      timestamp,
      status: "Expired",
      webhook_type: "status.updated",
    });
    const signature = createHmac("sha256", config.webhookSecret)
      .update(rawBody)
      .digest("hex");

    expect(
      provider.verifyAndNormalizeWebhook({
        rawBody,
        headers: new Headers({
          "x-timestamp": String(timestamp),
          "x-signature": signature,
        }),
        now: new Date(timestamp * 1000),
      }).result,
    ).toBe("FAILED");
  });
});
