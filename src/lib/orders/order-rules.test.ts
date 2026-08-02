import { describe, expect, it } from "vitest";

import {
  calculateLineSubtotal,
  calculateOrderTotals,
  canEditManualOrder,
  canTransitionManualOrder,
  parseManualOrderForm,
  validateVariantRelationship,
} from "@/lib/orders/order-rules";

function validForm() {
  const form = new FormData();
  Object.entries({
    customerName: "  Ana Pérez  ",
    customerEmail: " ANA@EXAMPLE.COM ",
    customerPhone: "4421234567",
    originChannel: "whatsapp",
    originChannelDetail: "",
    recipientName: "Ana Pérez",
    recipientPhone: "4421234567",
    street: "Reforma",
    exteriorNumber: "10",
    interiorNumber: "",
    neighborhood: "Centro",
    city: "Querétaro",
    state: "Querétaro",
    postalCode: "76000",
    references: " Portón verde ",
    shipping: "150.50",
    discount: "50",
    discountReason: "Promoción acordada",
    internalNote: " Contactar antes de enviar ",
  }).forEach(([key, value]) => form.set(key, value));
  form.append("productId", "41000000-0000-4000-8000-000000000001");
  form.append("variantId", "51000000-0000-4000-8000-000000000001");
  form.append("quantity", "2");
  return form;
}

describe("manual order money rules", () => {
  it("uses integer minor units for lines and totals", () => {
    expect(calculateLineSubtotal(12_550, 3)).toBe(37_650);
    expect(
      calculateOrderTotals({
        lines: [
          { unitPrice: 12_550, quantity: 3 },
          { unitPrice: 100, quantity: 2 },
        ],
        discount: 350,
        shipping: 1_500,
      }),
    ).toEqual({
      subtotal: 37_850,
      discount: 350,
      shipping: 1_500,
      total: 39_000,
    });
  });
  it("rejects invalid quantities, discounts and negative outcomes", () => {
    expect(() => calculateLineSubtotal(100, 0)).toThrow();
    expect(() => calculateLineSubtotal(100, 1.5)).toThrow();
    expect(() =>
      calculateOrderTotals({
        lines: [{ unitPrice: 100, quantity: 1 }],
        discount: 101,
        shipping: 0,
      }),
    ).toThrow();
    expect(() =>
      calculateOrderTotals({ lines: [], discount: 1, shipping: 0 }),
    ).toThrow();
  });
});

describe("manual order validation", () => {
  it("normalizes contact, address, money and items", () => {
    const parsed = parseManualOrderForm(validForm());
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.customer_name).toBe("Ana Pérez");
      expect(parsed.data.customer_email).toBe("ana@example.com");
      expect(parsed.data.shipping_total).toBe(15_050);
      expect(parsed.data.discount_total).toBe(5_000);
      expect(parsed.data.address.references).toBe("Portón verde");
      expect(parsed.data.items[0]?.quantity).toBe(2);
    }
  });
  it("rejects invalid address, quantities and discount reasons", () => {
    const address = validForm();
    address.set("postalCode", "7600");
    expect(parseManualOrderForm(address).success).toBe(false);
    const quantity = validForm();
    quantity.set("quantity", "1.5");
    expect(parseManualOrderForm(quantity).success).toBe(false);
    const discount = validForm();
    discount.set("discountReason", "");
    expect(parseManualOrderForm(discount).success).toBe(false);
  });
  it("requires a controlled detail only for the other channel", () => {
    const missing = validForm();
    missing.set("originChannel", "other");
    expect(parseManualOrderForm(missing).success).toBe(false);
    const extra = validForm();
    extra.set("originChannelDetail", "Marketplace");
    expect(parseManualOrderForm(extra).success).toBe(false);
  });
});

describe("manual order state and relationship rules", () => {
  it("permits only draft confirmation/cancellation and confirmed cancellation", () => {
    expect(canTransitionManualOrder("pending_confirmation", "preparing")).toBe(
      true,
    );
    expect(canTransitionManualOrder("pending_confirmation", "cancelled")).toBe(
      true,
    );
    expect(canTransitionManualOrder("preparing", "cancelled")).toBe(true);
    expect(canTransitionManualOrder("cancelled", "preparing")).toBe(false);
    expect(canEditManualOrder("pending_confirmation")).toBe(true);
    expect(canEditManualOrder("preparing")).toBe(false);
  });
  it("validates the exact product-variant pair", () => {
    const options = [{ productId: "product-a", variantId: "variant-a" }];
    expect(validateVariantRelationship("product-a", "variant-a", options)).toBe(
      true,
    );
    expect(validateVariantRelationship("product-b", "variant-a", options)).toBe(
      false,
    );
  });
});
