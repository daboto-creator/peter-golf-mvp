import { describe, expect, it } from "vitest";

import {
  calculateCartTotals,
  calculateCheckoutTotal,
  cartQuantitySchema,
  checkoutAddressSchema,
  checkoutAddressToPayload,
} from "@/lib/cart/cart-rules";

describe("customer cart rules", () => {
  it("normalizes positive integer quantities within the line limit", () => {
    expect(cartQuantitySchema.parse("2")).toBe(2);
    for (const value of ["0", "-1", "1.5", "100"]) {
      expect(cartQuantitySchema.safeParse(value).success).toBe(false);
    }
  });

  it("calculates cart and checkout totals with integer minor units", () => {
    expect(
      calculateCartTotals([
        { unitPrice: 12500, quantity: 2 },
        { unitPrice: 5000, quantity: 1 },
      ]),
    ).toEqual({ subtotal: 30000, unitCount: 3 });
    expect(calculateCheckoutTotal(30000, 14900)).toEqual({
      subtotal: 30000,
      discount: 0,
      tax: 0,
      shipping: 14900,
      total: 44900,
    });
  });

  it("rejects unsafe prices, quantities and inconsistent checkout money", () => {
    expect(() =>
      calculateCartTotals([{ unitPrice: 10.5, quantity: 1 }]),
    ).toThrow();
    expect(() =>
      calculateCartTotals([{ unitPrice: 100, quantity: 0 }]),
    ).toThrow();
    expect(() => calculateCheckoutTotal(100, -1)).toThrow();
  });

  it("validates and normalizes a Mexican shipping address", () => {
    const address = checkoutAddressSchema.parse({
      recipientName: " Ana Pérez ",
      phone: "4421234567",
      street: "Reforma",
      exteriorNumber: "10",
      interiorNumber: "",
      neighborhood: "Centro",
      city: "Querétaro",
      state: "Querétaro",
      postalCode: "76000",
      references: "",
    });
    expect(checkoutAddressToPayload(address)).toMatchObject({
      recipient_name: "Ana Pérez",
      interior_number: null,
      country_code: "MX",
    });
    expect(
      checkoutAddressSchema.safeParse({ ...address, postalCode: "7600" })
        .success,
    ).toBe(false);
  });
});
