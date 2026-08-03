import { describe, expect, it } from "vitest";

import { addressSchema, addressToPayload } from "./address-rules";

const valid = {
  label: "  Casa   principal ",
  recipientName: " Ana   Pérez ",
  phone: " 442 123 4567 ",
  street: " Av. Reforma ",
  exteriorNumber: " 10 ",
  interiorNumber: " ",
  neighborhood: " Centro ",
  city: " Querétaro ",
  state: " Querétaro ",
  postalCode: "76000",
  references: "  Portón   verde ",
  isDefault: true,
  countryCode: "MX" as const,
};

describe("customer address rules", () => {
  it("normalizes whitespace and optional values", () => {
    const parsed = addressSchema.parse(valid);
    expect(parsed).toMatchObject({
      label: "Casa principal",
      recipientName: "Ana Pérez",
      interiorNumber: null,
      references: "Portón verde",
    });
  });

  it("validates phone, label, postal code and fixed country", () => {
    expect(addressSchema.safeParse({ ...valid, phone: "123" }).success).toBe(
      false,
    );
    expect(addressSchema.safeParse({ ...valid, label: "X" }).success).toBe(
      false,
    );
    expect(
      addressSchema.safeParse({ ...valid, postalCode: "7600" }).success,
    ).toBe(false);
    expect(
      addressSchema.safeParse({ ...valid, countryCode: "US" }).success,
    ).toBe(false);
  });

  it("transforms an address to the server payload", () => {
    expect(addressToPayload(addressSchema.parse(valid))).toEqual(
      expect.objectContaining({
        recipient_name: "Ana Pérez",
        exterior_number: "10",
        postal_code: "76000",
        country_code: "MX",
        is_default: true,
      }),
    );
  });
});
