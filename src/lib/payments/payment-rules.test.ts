import { describe, expect, it } from "vitest";

import {
  canTransitionPayment,
  parseBankTransferForm,
  paymentMethodLabel,
  paymentStatusLabel,
} from "@/lib/payments/payment-rules";

function transferForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    transferReference: "REF-PRUEBA-123",
    transferDate: "2026-08-03",
    senderName: "Cliente Prueba",
    senderBank: "Banco de prueba",
    ...overrides,
  })) {
    form.set(key, value);
  }
  return form;
}

describe("order payment rules", () => {
  it("accepts and normalizes the minimum simulated transfer data", () => {
    expect(parseBankTransferForm(transferForm())).toEqual({
      success: true,
      data: {
        transferReference: "REF-PRUEBA-123",
        transferredAt: "2026-08-03T12:00:00.000Z",
        senderName: "Cliente Prueba",
        senderBank: "Banco de prueba",
      },
    });
    expect(
      parseBankTransferForm(transferForm({ senderName: "", senderBank: "" })),
    ).toMatchObject({
      success: true,
      data: { senderName: null, senderBank: null },
    });
  });

  it("rejects invalid references, dates and optional field lengths", () => {
    const invalidCases: Record<string, string>[] = [
      { transferReference: "x" },
      { transferDate: "03/08/2026" },
      { senderName: "x" },
      { senderBank: "x" },
    ];
    for (const overrides of invalidCases) {
      expect(parseBankTransferForm(transferForm(overrides)).success).toBe(
        false,
      );
    }
  });

  it("allows only the approved payment transition matrix", () => {
    expect(canTransitionPayment("pending", "submitted")).toBe(true);
    expect(canTransitionPayment("rejected", "submitted")).toBe(true);
    expect(canTransitionPayment("submitted", "under_review")).toBe(true);
    expect(canTransitionPayment("under_review", "paid")).toBe(true);
    expect(canTransitionPayment("paid", "refunded")).toBe(true);
    expect(canTransitionPayment("pending", "paid")).toBe(false);
    expect(canTransitionPayment("paid", "rejected")).toBe(false);
    expect(canTransitionPayment("refunded", "pending")).toBe(false);
  });

  it("presents every supported status and method in Spanish", () => {
    expect(paymentStatusLabel("under_review")).toBe("En revisión");
    expect(paymentStatusLabel("refunded")).toBe("Pago reembolsado");
    expect(paymentMethodLabel("bank_transfer")).toBe("Transferencia bancaria");
  });
});
