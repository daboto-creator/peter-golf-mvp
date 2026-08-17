import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CustomerStripeCheckoutButton } from "@/components/payments/customer-stripe-checkout-button";
import { StripePaymentStatus } from "@/components/payments/stripe-payment-status";
import { canStartStripeCheckout } from "@/lib/orders/order-transform";

vi.mock("@/lib/payments/stripe-actions", () => ({
  createStripeCheckoutAction: vi.fn(),
}));

afterEach(cleanup);

const baseAvailability = {
  paymentsMode: "test" as const,
  stripeMode: "test" as const,
  orderStatus: "pending_confirmation" as const,
  paymentStatus: "pending" as const,
  stripeStatus: "creating" as const,
  nowMs: Date.parse("2026-08-06T12:00:00.000Z"),
};

function renderButton(enabled: boolean) {
  render(
    <CustomerStripeCheckoutButton
      orderId="77000000-0000-4000-8000-000000000001"
      idempotencyKey="b7000000-0000-4000-8000-000000000001"
      enabled={enabled}
    />,
  );
  return screen.getByRole("button", {
    name: "Pagar con tarjeta de prueba",
  });
}

describe("Stripe Checkout stale-attempt recovery UI", () => {
  it("disables retry while a creating attempt is current", () => {
    const enabled = canStartStripeCheckout({
      ...baseAvailability,
      stripeExpiresAt: "2026-08-06T12:01:00.000Z",
    });

    expect(renderButton(enabled)).toBeDisabled();
  });

  it("enables retry when the same creating status is expired", () => {
    const enabled = canStartStripeCheckout({
      ...baseAvailability,
      stripeExpiresAt: "2026-08-06T11:59:59.000Z",
    });

    expect(renderButton(enabled)).toBeEnabled();
  });

  it("does not decide availability from status without checking expires_at", () => {
    const current = canStartStripeCheckout({
      ...baseAvailability,
      stripeExpiresAt: "2026-08-06T12:00:01.000Z",
    });
    const stale = canStartStripeCheckout({
      ...baseAvailability,
      stripeExpiresAt: "2026-08-06T12:00:00.000Z",
    });

    expect(current).toBe(false);
    expect(stale).toBe(true);
  });

  it("explains the new terminal abandoned state and allows another attempt", () => {
    render(
      <StripePaymentStatus
        orderStatus="preparing"
        paymentStatus="pending"
        stripeStatus="abandoned"
        stripeExpiresAt="2026-08-06T11:30:00.000Z"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Intento no completado",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Puedes intentarlo de nuevo",
    );
    expect(
      canStartStripeCheckout({
        ...baseAvailability,
        stripeStatus: "abandoned",
        stripeExpiresAt: "2026-08-06T11:30:00.000Z",
      }),
    ).toBe(true);
  });

  it("renders an expired creating row as terminal instead of preparing", () => {
    render(
      <StripePaymentStatus
        orderStatus="preparing"
        paymentStatus="pending"
        stripeStatus="creating"
        stripeExpiresAt="2020-01-01T00:00:00.000Z"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Intento no completado",
    );
    expect(screen.getByRole("status")).not.toHaveTextContent(
      "Preparando sesión",
    );
  });
});
