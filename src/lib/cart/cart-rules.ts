import { z } from "zod";

export const MAX_CART_ITEM_QUANTITY = 99;

export const cartQuantitySchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(MAX_CART_ITEM_QUANTITY);

export const checkoutAddressSchema = z.object({
  recipientName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(30),
  street: z.string().trim().min(1).max(160),
  exteriorNumber: z.string().trim().min(1).max(30),
  interiorNumber: z
    .string()
    .trim()
    .max(30)
    .transform((value) => value || null),
  neighborhood: z.string().trim().min(1).max(120),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().min(1).max(120),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/),
  references: z
    .string()
    .trim()
    .max(500)
    .transform((value) => value || null),
});

export type CheckoutAddress = z.infer<typeof checkoutAddressSchema>;

export function calculateCartTotals(
  lines: readonly { unitPrice: number; quantity: number }[],
) {
  let subtotal = 0;
  let unitCount = 0;
  for (const line of lines) {
    if (!Number.isSafeInteger(line.unitPrice) || line.unitPrice < 0) {
      throw new Error("Invalid unit price");
    }
    if (!cartQuantitySchema.safeParse(line.quantity).success) {
      throw new Error("Invalid quantity");
    }
    subtotal += line.unitPrice * line.quantity;
    unitCount += line.quantity;
    if (!Number.isSafeInteger(subtotal) || !Number.isSafeInteger(unitCount)) {
      throw new Error("Cart total out of range");
    }
  }
  return { subtotal, unitCount };
}

export function calculateCheckoutTotal(subtotal: number, shipping: number) {
  if (
    !Number.isSafeInteger(subtotal) ||
    subtotal < 0 ||
    !Number.isSafeInteger(shipping) ||
    shipping < 0
  ) {
    throw new Error("Invalid checkout total");
  }
  const total = subtotal + shipping;
  if (!Number.isSafeInteger(total))
    throw new Error("Checkout total out of range");
  return { subtotal, discount: 0, tax: 0, shipping, total };
}

export function checkoutAddressToPayload(address: CheckoutAddress) {
  return {
    recipient_name: address.recipientName,
    phone: address.phone,
    street: address.street,
    exterior_number: address.exteriorNumber,
    interior_number: address.interiorNumber,
    neighborhood: address.neighborhood,
    city: address.city,
    state: address.state,
    postal_code: address.postalCode,
    references: address.references,
    country_code: "MX",
  };
}
