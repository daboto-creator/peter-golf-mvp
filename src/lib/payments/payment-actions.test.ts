import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOrdersManager: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  refundsCreate: vi.fn(),
  maybeSingle: vi.fn(),
  revalidatePath: vi.fn(),
  env: {
    PAYMENTS_MODE: "test" as "test" | "disabled",
    STRIPE_CHECKOUT_MODE: "test" as "test" | "disabled",
  },
}));

vi.mock("@/env/server", () => ({
  serverEnv: mocks.env,
}));

vi.mock("@/lib/auth/order-authorization", () => ({
  requireOrdersManager: mocks.requireOrdersManager,
}));

vi.mock("@/lib/auth/user", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

vi.mock("@/lib/stripe/server", () => ({
  getStripeClient: () => ({
    refunds: {
      create: mocks.refundsCreate,
    },
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: mocks.maybeSingle,
        })),
      })),
    })),
  })),
}));

import { refundStripePaymentAction } from "@/lib/payments/payment-actions";

const orderId = "77000000-0000-4000-8000-000000000001";
const paymentId = "88000000-0000-4000-8000-000000000001";
const requestKey = "99000000-0000-4000-8000-000000000001";

function form() {
  const formData = new FormData();
  formData.set("orderId", orderId);
  formData.set("idempotencyKey", requestKey);
  return formData;
}

function paidStripeOrder() {
  return {
    id: orderId,
    order_payments: {
      id: paymentId,
      provider: "stripe",
      status: "paid",
      expected_amount: 114900,
      refunded_amount: 0,
      stripe_checkout_sessions: [
        {
          stripe_payment_intent_id: "pi_test_payment_intent_123",
          status: "completed",
          completed_at: "2026-08-17T20:00:00.000Z",
          created_at: "2026-08-17T19:59:00.000Z",
        },
      ],
    },
  };
}

describe("refundStripePaymentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.PAYMENTS_MODE = "test";
    mocks.env.STRIPE_CHECKOUT_MODE = "test";
    mocks.requireOrdersManager.mockResolvedValue(undefined);
    mocks.refundsCreate.mockResolvedValue({ id: "re_test_refund_123" });
    mocks.maybeSingle.mockResolvedValue({
      data: paidStripeOrder(),
      error: null,
    });
  });

  test("requests a full Stripe refund and leaves state changes to the webhook", async () => {
    const result = await refundStripePaymentAction(
      { status: "idle", message: "" },
      form(),
    );

    expect(mocks.requireOrdersManager).toHaveBeenCalledWith(
      `/operacion/pedidos/${orderId}`,
    );

    expect(mocks.refundsCreate).toHaveBeenCalledWith(
      {
        payment_intent: "pi_test_payment_intent_123",
        metadata: {
          order_id: orderId,
          payment_id: paymentId,
        },
      },
      {
        idempotencyKey: `pg_full_refund_${paymentId}`,
      },
    );

    expect(result).toEqual({
      status: "success",
      message:
        "Reembolso solicitado a Stripe. El estado se actualizará mediante webhook.",
    });

    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      `/operacion/pedidos/${orderId}`,
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      `/cuenta/pedidos/${orderId}`,
    );
  });

  test("uses payment-based idempotency instead of the browser request key", async () => {
    await refundStripePaymentAction({ status: "idle", message: "" }, form());

    const options = mocks.refundsCreate.mock.calls[0]?.[1];

    expect(options?.idempotencyKey).toBe(`pg_full_refund_${paymentId}`);
    expect(options?.idempotencyKey).not.toContain(requestKey);
  });

  test("rejects a Stripe payment that is not currently paid", async () => {
    const order = paidStripeOrder();
    order.order_payments.status = "refunded";

    mocks.maybeSingle.mockResolvedValue({
      data: order,
      error: null,
    });

    const result = await refundStripePaymentAction(
      { status: "idle", message: "" },
      form(),
    );

    expect(result.status).toBe("error");
    expect(result.message).toBe(
      "Este pago Stripe no está disponible para reembolso total.",
    );
    expect(mocks.refundsCreate).not.toHaveBeenCalled();
  });

  test("does not refund when the completed PaymentIntent cannot be found", async () => {
    const order = paidStripeOrder();
    order.order_payments.stripe_checkout_sessions = [];

    mocks.maybeSingle.mockResolvedValue({
      data: order,
      error: null,
    });

    const result = await refundStripePaymentAction(
      { status: "idle", message: "" },
      form(),
    );

    expect(result).toEqual({
      status: "error",
      message: "No encontramos el pago confirmado en Stripe.",
    });
    expect(mocks.refundsCreate).not.toHaveBeenCalled();
  });

  test("fails closed when Stripe rejects the refund request", async () => {
    mocks.refundsCreate.mockRejectedValue(new Error("stripe unavailable"));

    const result = await refundStripePaymentAction(
      { status: "idle", message: "" },
      form(),
    );

    expect(result).toEqual({
      status: "error",
      message: "No pudimos solicitar el reembolso en Stripe.",
    });
  });

  test("blocks refunds when Stripe test mode is disabled", async () => {
    mocks.env.STRIPE_CHECKOUT_MODE = "disabled";

    const result = await refundStripePaymentAction(
      { status: "idle", message: "" },
      form(),
    );

    expect(result).toEqual({
      status: "error",
      message: "Los reembolsos Stripe de prueba están deshabilitados.",
    });
    expect(mocks.refundsCreate).not.toHaveBeenCalled();
    expect(mocks.maybeSingle).not.toHaveBeenCalled();
  });
});
