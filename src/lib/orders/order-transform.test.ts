import { describe, expect, it } from "vitest";

import {
  normalizeManualOrderAddress,
  normalizeManualOrderSummary,
  type ManualOrderListRecord,
} from "@/lib/orders/order-transform";

const record: ManualOrderListRecord = {
  id: "order-id",
  order_number: "PG-M-ABC123ABC123",
  customer_name: "Ana Pérez",
  customer_email: null,
  customer_phone: "4421234567",
  origin_channel: "whatsapp",
  origin: "manual",
  status: "pending_confirmation",
  order_payments: { status: "pending" },
  total: 25_000,
  currency: "MXN",
  created_at: "2026-08-01T12:00:00Z",
  updated_at: "2026-08-01T12:00:00Z",
  order_items: [{ quantity: 2 }, { quantity: 3 }],
};

describe("manual order transformations", () => {
  it("normalizes a list record and sums item quantities", () => {
    expect(normalizeManualOrderSummary(record)).toMatchObject({
      orderNumber: "PG-M-ABC123ABC123",
      customerName: "Ana Pérez",
      itemCount: 5,
      total: 25_000,
    });
    expect(
      normalizeManualOrderSummary({ ...record, customer_name: null }),
    ).toBeNull();
  });

  it("normalizes the address snapshot without unsafe assumptions", () => {
    expect(
      normalizeManualOrderAddress({
        recipient_name: "Ana Pérez",
        phone: "4421234567",
        street: "Reforma",
        exterior_number: "10",
        interior_number: null,
        neighborhood: "Centro",
        city: "Querétaro",
        state: "Querétaro",
        postal_code: "76000",
        references: "Portón verde",
      }),
    ).toEqual({
      recipientName: "Ana Pérez",
      phone: "4421234567",
      street: "Reforma",
      exteriorNumber: "10",
      interiorNumber: null,
      neighborhood: "Centro",
      city: "Querétaro",
      state: "Querétaro",
      postalCode: "76000",
      references: "Portón verde",
    });
  });
});
