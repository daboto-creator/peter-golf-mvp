import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const cartSchema = z.object({
  cart_id: z.string().uuid().nullable(),
  version: z.number().int().positive().nullable(),
  currency: z.string().length(3),
  unit_count: z.number().int().nonnegative(),
  subtotal: z.number().int().nonnegative(),
  has_issues: z.boolean(),
  items: z.array(
    z.object({
      id: z.string().uuid(),
      product_id: z.string().uuid().nullable(),
      variant_id: z.string().uuid().nullable(),
      slug: z.string().nullable(),
      product_name: z.string(),
      variant_name: z.string(),
      sku: z.string(),
      quantity: z.number().int().positive(),
      unit_price: z.number().int().nonnegative(),
      line_total: z.number().int().nonnegative(),
      price_changed: z.boolean(),
      availability: z.enum(["available", "low", "insufficient", "unavailable"]),
      image_path: z.string().nullable(),
    }),
  ),
});

export type CustomerCart = z.infer<typeof cartSchema>;

export type CustomerAddress = {
  id: string;
  label: string;
  recipientName: string;
  phone: string | null;
  line1: string;
  line2: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  postalCode: string;
};

export type CustomerShippingMethod = {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  currency: string;
};

export async function getCustomerCart(): Promise<CustomerCart | null> {
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("get_customer_cart");
    if (error) return null;
    const parsed = cartSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function getCustomerCheckoutContext(): Promise<{
  addresses: CustomerAddress[];
  shippingMethod: CustomerShippingMethod | null;
} | null> {
  try {
    const client = await createClient();
    const [addressResult, shippingResult] = await Promise.all([
      client
        .from("addresses")
        .select(
          "id, label, recipient_name, phone, line_1, line_2, neighborhood, city, state, postal_code",
        )
        .is("archived_at", null)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false }),
      client.rpc("get_customer_shipping_method"),
    ]);
    if (addressResult.error || shippingResult.error) return null;
    const method = shippingResult.data[0];
    return {
      addresses: addressResult.data.map((address) => ({
        id: address.id,
        label: address.label,
        recipientName: address.recipient_name,
        phone: address.phone,
        line1: address.line_1,
        line2: address.line_2,
        neighborhood: address.neighborhood,
        city: address.city,
        state: address.state,
        postalCode: address.postal_code,
      })),
      shippingMethod: method
        ? {
            id: method.shipping_method_id,
            name: method.name,
            description: method.description,
            basePrice: method.base_price,
            currency: method.currency,
          }
        : null,
    };
  } catch {
    return null;
  }
}
