import { beforeEach, describe, expect, test, vi } from "vitest";

import type { StripeWebhookRpcInput } from "@/lib/stripe/webhook-processing";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
  single: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/env/server", () => ({
  serverEnv: {
    NEXT_PUBLIC_SUPABASE_URL: "https://project.example.test",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test-only",
    STRIPE_CHECKOUT_MODE: "test",
  },
}));

import {
  processStripeWebhookEvent,
  StripeWebhookDatabaseError,
} from "@/lib/supabase/service-role";

const input: StripeWebhookRpcInput = {
  requested_event_id: "evt_sensitive_full_id",
  requested_event_type: "checkout.session.completed",
  requested_event_created_at: "2026-08-06T12:00:00.000Z",
  requested_api_version: "2026-06-24.dahlia",
  requested_livemode: false,
  requested_payload_hash: "a".repeat(64),
  requested_checkout_session_id: "cs_test_sensitive_full_id",
  requested_checkout_attempt_id: "11111111-1111-4111-8111-111111111111",
  requested_payment_id: "22222222-2222-4222-8222-222222222222",
  requested_payment_intent_id: "pi_sensitive_full_id",
  requested_amount: 114900,
  requested_currency: "MXN",
  requested_payment_status: "paid",
  requested_refund_id: null,
  requested_refund_status: null,
  requested_failure_reason: null,
  requested_refund_created_at: null,
};

describe("processStripeWebhookEvent Supabase transport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockReturnValue({ rpc: mocks.rpc });
    mocks.rpc.mockReturnValue({ single: mocks.single });
  });

  test("requests and returns exactly one RPC row with single()", async () => {
    const row = { processed: true, replayed: false, outcome: "processed" };
    mocks.single.mockResolvedValue({ data: row, error: null });

    await expect(processStripeWebhookEvent(input)).resolves.toEqual(row);

    expect(mocks.rpc).toHaveBeenCalledWith(
      "process_stripe_webhook_event",
      input,
    );
    expect(mocks.single).toHaveBeenCalledOnce();
  });

  test("preserves PGRST202 when single() returns null data", async () => {
    mocks.single.mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message: "sensitive database message",
        details: "sensitive database details",
        hint: null,
      },
    });

    await expect(processStripeWebhookEvent(input)).rejects.toMatchObject({
      name: "StripeWebhookDatabaseError",
      retryable: true,
      code: "PGRST202",
    });
  });

  test("keeps a network error without code retryable and drops its message", async () => {
    mocks.single.mockResolvedValue({
      data: null,
      error: {
        message: "gateway failure for customer@example.test",
        details: "pi_sensitive_full_id",
      },
    });

    let thrown: unknown;
    try {
      await processStripeWebhookEvent(input);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(StripeWebhookDatabaseError);
    expect(thrown).toMatchObject({ retryable: true });
    expect(JSON.stringify(thrown)).not.toMatch(
      /customer@|sensitive|message|details|payload|metadata/i,
    );
  });
});
