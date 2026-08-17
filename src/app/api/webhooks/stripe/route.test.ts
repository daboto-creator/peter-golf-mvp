import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type Stripe from "stripe";

const mocks = vi.hoisted(() => ({
  process: vi.fn(),
  constructEvent: vi.fn(),
}));

vi.mock("@/env/server", () => ({
  serverEnv: {
    STRIPE_CHECKOUT_MODE: "test",
    STRIPE_WEBHOOK_SECRET: "whsec_test_only",
  },
}));

vi.mock("@/lib/stripe/server", () => ({
  getStripeClient: () => ({
    webhooks: { constructEvent: mocks.constructEvent },
  }),
}));

vi.mock("@/lib/supabase/service-role", () => {
  class StripeWebhookDatabaseError extends Error {
    constructor(
      readonly retryable: boolean,
      readonly code?: string,
      readonly hintCode?: string,
    ) {
      super("Stripe webhook processing failed.");
    }
  }
  return {
    processStripeWebhookEvent: mocks.process,
    StripeWebhookDatabaseError,
  };
});

import { POST } from "@/app/api/webhooks/stripe/route";
import { StripeWebhookDatabaseError } from "@/lib/supabase/service-role";

const event = {
  id: "evt_sensitive_full_id",
  type: "checkout.session.completed",
  created: 1_786_012_345,
  api_version: "2026-06-24.dahlia",
  livemode: false,
  data: {
    object: {
      id: "cs_test_sensitive_full_id",
      payment_intent: "pi_sensitive_full_id",
      amount_total: 114900,
      currency: "mxn",
      payment_status: "paid",
      metadata: {
        checkout_attempt_id: "11111111-1111-4111-8111-111111111111",
        payment_id: "22222222-2222-4222-8222-222222222222",
      },
      customer_details: { email: "customer@example.test" },
    },
  },
} as unknown as Stripe.Event;

function request() {
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": "test-signature" },
    body: '{"signed":"body"}',
  });
}

describe("Stripe webhook route responses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.constructEvent.mockReturnValue(event);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("acknowledges an audited permanent rejection without logging IDs or PII", async () => {
    mocks.process.mockResolvedValue({
      processed: false,
      replayed: false,
      outcome: "completion_amount",
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      received: false,
      code: "rejected",
    });
    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).toContain("completion_amount");
    expect(logged).not.toMatch(
      /sensitive|11111111|22222222|customer@|signed|metadata|test-signature/i,
    );
  });

  test("returns a retryable 5xx for transient database failures", async () => {
    mocks.process.mockRejectedValue(
      new StripeWebhookDatabaseError(
        true,
        "P0002",
        "stripe_checkout_session_missing",
      ),
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
    expect(JSON.stringify(consoleError.mock.calls)).toContain(
      "stripe_checkout_session_missing",
    );
  });

  test("acknowledges a processed duplicate idempotently", async () => {
    mocks.process.mockResolvedValue({
      processed: true,
      replayed: true,
      outcome: "processed",
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      received: true,
      replayed: true,
    });
  });
});
