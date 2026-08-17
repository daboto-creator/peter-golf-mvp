import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OrderStateActions } from "@/components/operations/order-actions";
import type { ManualOrderDetail } from "@/lib/orders/operational-orders";

vi.mock("@/lib/orders/order-actions", () => ({
  cancelManualOrderAction: vi.fn(),
  confirmManualOrderAction: vi.fn(),
}));

afterEach(cleanup);

const baseOrder: ManualOrderDetail = {
  id: "77000000-0000-4000-8000-000000000001",
  orderNumber: "PG-0001",
  customerName: "Cliente de prueba",
  customerEmail: "cliente@example.com",
  customerPhone: "5555555555",
  channel: "whatsapp",
  origin: "manual",
  status: "pending_confirmation",
  paymentStatus: "pending",
  paymentProvider: "manual",
  total: 1000,
  currency: "MXN",
  itemCount: 1,
  createdAt: "2026-08-17T12:00:00.000Z",
  updatedAt: "2026-08-17T12:00:00.000Z",
  version: 1,
  discountTotal: 0,
  discountReason: null,
  shippingTotal: 0,
  subtotal: 1000,
  internalNote: null,
  originChannelDetail: null,
  payment: {
    id: "88000000-0000-4000-8000-000000000001",
    provider: "manual",
    method: "bank_transfer",
    status: "pending",
    expectedAmount: 1000,
    refundedAmount: 0,
    currency: "MXN",
    version: 1,
    submittedAt: null,
    underReviewAt: null,
    paidAt: null,
    rejectedAt: null,
    refundedAt: null,
    stripeCheckoutStatus: null,
    submissions: [],
    history: [],
  },
  confirmedAt: null,
  cancelledAt: null,
  cancellationReason: null,
  address: {
    recipientName: "Cliente de prueba",
    phone: "5555555555",
    street: "Calle Uno",
    exteriorNumber: "1",
    interiorNumber: null,
    neighborhood: "Centro",
    city: "Ciudad de México",
    state: "Ciudad de México",
    postalCode: "06000",
    references: null,
  },
  items: [],
  history: [],
};

function renderActions(order: ManualOrderDetail) {
  render(
    <OrderStateActions
      order={order}
      confirmKey="99000000-0000-4000-8000-000000000001"
      cancelKey="99000000-0000-4000-8000-000000000002"
    />,
  );
}

describe("OrderStateActions", () => {
  it("waits for Stripe payment before offering confirmation", () => {
    renderActions({
      ...baseOrder,
      paymentProvider: "stripe",
      payment: {
        ...baseOrder.payment!,
        provider: "stripe",
        method: "card",
        status: "pending",
      },
    });

    expect(
      screen.queryByRole("button", {
        name: "Confirmar y descontar inventario",
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Estamos esperando la confirmación del pago por Stripe. El inventario no se descontará hasta que el pago esté confirmado.",
    );
  });

  it("offers confirmation when Stripe payment is paid", () => {
    renderActions({
      ...baseOrder,
      paymentStatus: "paid",
      paymentProvider: "stripe",
      payment: {
        ...baseOrder.payment!,
        provider: "stripe",
        method: "card",
        status: "paid",
      },
    });

    expect(
      screen.getByRole("button", {
        name: "Confirmar y descontar inventario",
      }),
    ).toBeEnabled();
  });

  it("keeps offering confirmation for a pending manual payment", () => {
    renderActions(baseOrder);

    expect(
      screen.getByRole("button", {
        name: "Confirmar y descontar inventario",
      }),
    ).toBeEnabled();
  });
});
