import { describe, expect, test } from "vitest";

import {
  isAllowedStripeWebhookEvent,
  isStripeTestSecretKey,
  parseStripeInternalMetadata,
  stripeObjectId,
} from "@/lib/stripe/stripe-rules";

describe("Stripe test-mode rules", () => {
  test("allows only the approved webhook event set", () => {
    expect(isAllowedStripeWebhookEvent("checkout.session.completed")).toBe(
      true,
    );
    expect(isAllowedStripeWebhookEvent("refund.failed")).toBe(true);
    expect(isAllowedStripeWebhookEvent("charge.succeeded")).toBe(false);
  });

  test("accepts test secret keys and rejects live or publishable keys", () => {
    expect(isStripeTestSecretKey("sk_test_synthetic")).toBe(true);
    expect(isStripeTestSecretKey("sk_live_forbidden")).toBe(false);
    expect(isStripeTestSecretKey("pk_test_not_server_secret")).toBe(false);
  });

  test("accepts only UUID internal metadata", () => {
    expect(
      parseStripeInternalMetadata({
        checkout_attempt_id: "11111111-1111-4111-8111-111111111111",
        payment_id: "22222222-2222-4222-8222-222222222222",
      }).success,
    ).toBe(true);
    expect(
      parseStripeInternalMetadata({
        checkout_attempt_id: "not-a-uuid",
        payment_id: "22222222-2222-4222-8222-222222222222",
      }).success,
    ).toBe(false);
  });

  test("extracts expanded and unexpanded Stripe IDs", () => {
    expect(stripeObjectId("pi_test", "pi_")).toBe("pi_test");
    expect(stripeObjectId({ id: "pi_expanded" }, "pi_")).toBe("pi_expanded");
    expect(stripeObjectId({ id: "ch_wrong" }, "pi_")).toBeNull();
  });
});
