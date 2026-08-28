import "server-only";

import { z } from "zod";

import {
  getMarketplaceCartIssue,
  type MarketplaceCartIssue,
} from "@/lib/marketplace/publication-rules";
import { createClient } from "@/lib/supabase/server";

const cartSchema = z.object({
  cart_id: z.string().uuid().nullable(),
  version: z.number().int().positive().nullable(),
  currency: z.string().length(3),
  unit_count: z.number().int().nonnegative(),
  subtotal: z.number().int().nonnegative(),
  has_issues: z.boolean(),
  has_marketplace_items: z.boolean().default(false),
  items: z.array(
    z.object({
      id: z.string().uuid(),
      item_source: z
        .enum(["FIRST_PARTY", "MARKETPLACE_PARTNER"])
        .default("FIRST_PARTY"),
      product_id: z.string().uuid().nullable(),
      variant_id: z.string().uuid().nullable(),
      listing_id: z.string().uuid().nullable().optional(),
      listing_version_id: z.string().uuid().nullable().optional(),
      pricing_quote_id: z.string().uuid().nullable().optional(),
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
      marketplace_issue: z
        .enum([
          "none",
          "price_changed",
          "listing_changed",
          "unavailable",
          "marketplace_disabled",
        ])
        .default("none"),
      marketplace_blockers: z.array(z.string()).default([]),
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
  exteriorNumber: string | null;
  line2: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  postalCode: string;
  references: string | null;
  isDefault: boolean;
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
    if (!parsed.success) return null;
    if (!parsed.data.has_marketplace_items) return parsed.data;
    const readiness = await client.rpc(
      "get_customer_marketplace_cart_readiness",
    );
    const byItemId = new Map(
      (readiness.data ?? []).map((entry) => [entry.cart_item_id, entry]),
    );
    let hasMarketplaceIssue = Boolean(readiness.error);
    const items = parsed.data.items.map((item) => {
      if (item.item_source !== "MARKETPLACE_PARTNER") return item;
      const state = byItemId.get(item.id);
      const marketplaceIssue: MarketplaceCartIssue = state
        ? getMarketplaceCartIssue({
            listingVersionChanged: state.listing_version_changed,
            priceChanged: state.price_changed || item.price_changed,
            available: state.available,
            blockers: state.blocker_codes,
          })
        : "unavailable";
      hasMarketplaceIssue ||= marketplaceIssue !== "none";
      return {
        ...item,
        price_changed:
          marketplaceIssue === "price_changed" || item.price_changed,
        availability: state?.available ? item.availability : "unavailable",
        image_path:
          state?.image_id && item.listing_id
            ? `/api/marketplace/images/${item.listing_id}/${state.image_id}`
            : item.image_path,
        marketplace_issue: marketplaceIssue,
        marketplace_blockers: state?.blocker_codes ?? [],
      };
    });
    return {
      ...parsed.data,
      items,
      has_issues: parsed.data.has_issues || hasMarketplaceIssue,
    };
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
          "id, label, recipient_name, phone, line_1, exterior_number, line_2, neighborhood, city, state, postal_code, delivery_references, is_default",
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
        exteriorNumber: address.exterior_number,
        line2: address.line_2,
        neighborhood: address.neighborhood,
        city: address.city,
        state: address.state,
        postalCode: address.postal_code,
        references: address.delivery_references,
        isDefault: address.is_default,
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
