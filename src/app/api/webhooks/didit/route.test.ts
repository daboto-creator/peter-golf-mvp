import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  process: vi.fn(),
}));

vi.mock("@/lib/identity-verification/provider", () => ({
  getIdentityVerificationProvider: () => ({
    name: "DIDIT",
    verifyAndNormalizeWebhook: mocks.verify,
  }),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  processPartnerIdentityWebhook: mocks.process,
}));

import { POST } from "@/app/api/webhooks/didit/route";

const normalized = {
  eventId: "55555555-5555-4555-8555-555555555555",
  externalSessionId: "33333333-3333-4333-8333-333333333333",
  occurredAt: "2026-11-06T12:00:00.000Z",
  result: "PASSED" as const,
  attributes: { livenessPassed: true, faceMatchPassed: true },
  warningCodes: [],
};

function request(body = '{"signed":"payload"}') {
  return new Request("http://localhost/api/webhooks/didit", {
    method: "POST",
    headers: { "x-signature": "provider-signature-secret" },
    body,
  });
}

describe("Didit identity webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verify.mockReturnValue(normalized);
    mocks.process.mockResolvedValue(true);
  });

  afterEach(() => vi.restoreAllMocks());

  test("accepts a valid provider signature and persists normalized evidence", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      received: true,
      replayed: false,
    });
    expect(mocks.verify).toHaveBeenCalledOnce();
    expect(mocks.process).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "DIDIT",
        eventId: normalized.eventId,
      }),
    );
  });

  test("rejects invalid signatures without calling the database processor", async () => {
    mocks.verify.mockImplementation(() => {
      throw new Error("signature rejected; provider secret must stay private");
    });

    const response = await POST(request());

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ received: false, code: "rejected" });
    expect(mocks.process).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toContain("secret");
  });

  test("rejects malformed payloads without calling the database processor", async () => {
    mocks.verify.mockImplementation(() => {
      throw new Error("malformed provider payload");
    });

    const response = await POST(request("{"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      received: false,
      code: "rejected",
    });
    expect(mocks.process).not.toHaveBeenCalled();
  });

  test("fails safely and requests retry when database persistence fails", async () => {
    mocks.process.mockRejectedValue(
      new Error("database error contains provider secret"),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const response = await POST(request());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      received: false,
      code: "retry",
    });
    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).toContain("database_processing_failed");
    expect(logged).not.toMatch(/secret|signed|payload|signature/i);
  });

  test("acknowledges a duplicate webhook idempotently", async () => {
    mocks.process.mockResolvedValue(false);

    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      received: true,
      replayed: true,
    });
  });
});
