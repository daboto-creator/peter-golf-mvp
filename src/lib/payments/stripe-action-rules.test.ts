import { describe, expect, test } from "vitest";

import {
  getStripeCheckoutExpiresAt,
  sanitizeStripeCheckoutError,
  stripeCheckoutExpirationSeconds,
} from "@/lib/payments/stripe-action-rules";

describe("Stripe Checkout action diagnostics", () => {
  test("keeps only allowlisted Stripe error fields", () => {
    const diagnostic = sanitizeStripeCheckoutError(
      {
        type: "StripePermissionError",
        code: "permission_denied",
        statusCode: 403,
        param: "line_items[0].price_data.currency",
        requestId: "req_123AbC",
        message: "must not be logged",
        stack: "must not be logged",
        headers: { authorization: "must not be logged" },
        raw: { metadata: { order_id: "must not be logged" } },
        url: "https://checkout.stripe.com/must-not-be-logged",
        paymentIntent: "pi_must_not_be_logged",
      },
      "stripe_create",
    );

    expect(diagnostic).toEqual({
      category: "stripe_permission",
      stripeErrorType: "StripePermissionError",
      code: "permission_denied",
      statusCode: 403,
      param: "line_items[0].price_data.currency",
      requestId: "req_123AbC",
      stage: "stripe_create",
    });
    expect(JSON.stringify(diagnostic)).not.toMatch(
      /must not|authorization|metadata|checkout\.stripe|paymentIntent|stack/i,
    );
  });

  test("rejects untrusted diagnostic values", () => {
    expect(
      sanitizeStripeCheckoutError(
        {
          type: "StripeError secret",
          code: "secret value with spaces",
          statusCode: 999,
          param: "email=user@example.test",
          requestId: "not-a-request-id",
        },
        "stripe_create",
      ),
    ).toEqual({ category: "application", stage: "stripe_create" });
  });

  test("classifies database and local validation failures by stage", () => {
    expect(sanitizeStripeCheckoutError({ code: "23505" }, "attach")).toEqual({
      category: "database",
      code: "23505",
      stage: "attach",
    });
    expect(
      sanitizeStripeCheckoutError({ code: "missing_session_url" }, "redirect"),
    ).toEqual({
      category: "validation",
      code: "missing_session_url",
      stage: "redirect",
    });
  });

  test("adds a small safety margin above Stripe's 30 minute minimum", () => {
    const nowMs = 1_800_000_123;
    const expiresAt = getStripeCheckoutExpiresAt(nowMs);

    expect(expiresAt).toBe(
      Math.ceil(nowMs / 1000) + stripeCheckoutExpirationSeconds,
    );
    expect(expiresAt - Math.ceil(nowMs / 1000)).toBe(1803);
  });
});
