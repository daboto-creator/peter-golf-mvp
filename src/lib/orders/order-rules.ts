import { z } from "zod";

import { parseMoneyToMinorUnits } from "@/lib/catalog/product-validation";

export const manualOrderChannels = [
  "whatsapp",
  "instagram",
  "phone",
  "in_person",
  "bank_transfer",
  "other",
] as const;
export type ManualOrderChannel = (typeof manualOrderChannels)[number];
export type ManualOrderState =
  "pending_confirmation" | "preparing" | "cancelled";

export type ManualOrderPayload = {
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  origin_channel: ManualOrderChannel;
  origin_channel_detail: string | null;
  address: {
    recipient_name: string;
    phone: string;
    street: string;
    exterior_number: string;
    interior_number: string | null;
    neighborhood: string;
    city: string;
    state: string;
    postal_code: string;
    references: string | null;
  };
  shipping_total: number;
  discount_total: number;
  discount_reason: string | null;
  internal_note: string | null;
  items: { product_id: string; variant_id: string; quantity: number }[];
};

const trimmed = (minimum: number, maximum: number) =>
  z.string().trim().min(minimum).max(maximum);
const optionalTrimmed = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .transform((value) => value || null);
const uuid = z.uuid();

const formSchema = z
  .object({
    customerName: trimmed(2, 120),
    customerEmail: z
      .string()
      .trim()
      .max(254)
      .transform((value) => value.toLowerCase())
      .pipe(z.union([z.literal(""), z.email()])),
    customerPhone: trimmed(7, 30),
    originChannel: z.enum(manualOrderChannels),
    originChannelDetail: optionalTrimmed(80),
    recipientName: trimmed(2, 120),
    recipientPhone: trimmed(7, 30),
    street: trimmed(1, 160),
    exteriorNumber: trimmed(1, 30),
    interiorNumber: optionalTrimmed(30),
    neighborhood: trimmed(1, 120),
    city: trimmed(1, 120),
    state: trimmed(1, 120),
    postalCode: z
      .string()
      .trim()
      .regex(/^\d{5}$/),
    references: optionalTrimmed(500),
    shipping: z.string(),
    discount: z.string(),
    discountReason: optionalTrimmed(300),
    internalNote: optionalTrimmed(2000),
    productIds: z.array(uuid).min(1).max(100),
    variantIds: z.array(uuid).min(1).max(100),
    quantities: z.array(z.coerce.number().int().min(1).max(1_000_000)),
  })
  .superRefine((data, context) => {
    if (data.originChannel === "other" && !data.originChannelDetail) {
      context.addIssue({
        code: "custom",
        path: ["originChannelDetail"],
        message: "Describe el otro canal.",
      });
    }
    if (data.originChannel !== "other" && data.originChannelDetail) {
      context.addIssue({
        code: "custom",
        path: ["originChannelDetail"],
        message: "El detalle sólo corresponde al canal Otro.",
      });
    }
    if (
      data.productIds.length !== data.variantIds.length ||
      data.productIds.length !== data.quantities.length
    ) {
      context.addIssue({
        code: "custom",
        message: "Las partidas no coinciden.",
      });
    }
  });

export function calculateLineSubtotal(unitPrice: number, quantity: number) {
  if (!Number.isSafeInteger(unitPrice) || unitPrice < 0) {
    throw new Error("Invalid unit price");
  }
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error("Invalid quantity");
  }
  const subtotal = unitPrice * quantity;
  if (!Number.isSafeInteger(subtotal)) throw new Error("Subtotal out of range");
  return subtotal;
}

export function calculateOrderTotals({
  lines,
  discount,
  shipping,
}: {
  lines: { unitPrice: number; quantity: number }[];
  discount: number;
  shipping: number;
}) {
  if (!Number.isSafeInteger(discount) || discount < 0) {
    throw new Error("Invalid discount");
  }
  if (!Number.isSafeInteger(shipping) || shipping < 0) {
    throw new Error("Invalid shipping");
  }
  const subtotal = lines.reduce(
    (sum, line) => sum + calculateLineSubtotal(line.unitPrice, line.quantity),
    0,
  );
  if (!Number.isSafeInteger(subtotal) || discount > subtotal) {
    throw new Error("Invalid order totals");
  }
  const total = subtotal - discount + shipping;
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new Error("Invalid order total");
  }
  return { subtotal, discount, shipping, total };
}

export const manualOrderTransitions: Readonly<
  Record<ManualOrderState, readonly ManualOrderState[]>
> = {
  pending_confirmation: ["preparing", "cancelled"],
  preparing: ["cancelled"],
  cancelled: [],
};

export function canTransitionManualOrder(
  from: ManualOrderState,
  to: ManualOrderState,
) {
  return manualOrderTransitions[from].includes(to);
}

export function canEditManualOrder(status: ManualOrderState) {
  return status === "pending_confirmation";
}

export function parseManualOrderForm(
  formData: FormData,
):
  | { success: true; data: ManualOrderPayload }
  | { success: false; message: string } {
  const result = formSchema.safeParse({
    customerName: formData.get("customerName"),
    customerEmail: formData.get("customerEmail"),
    customerPhone: formData.get("customerPhone"),
    originChannel: formData.get("originChannel"),
    originChannelDetail: formData.get("originChannelDetail"),
    recipientName: formData.get("recipientName"),
    recipientPhone: formData.get("recipientPhone"),
    street: formData.get("street"),
    exteriorNumber: formData.get("exteriorNumber"),
    interiorNumber: formData.get("interiorNumber"),
    neighborhood: formData.get("neighborhood"),
    city: formData.get("city"),
    state: formData.get("state"),
    postalCode: formData.get("postalCode"),
    references: formData.get("references"),
    shipping: formData.get("shipping"),
    discount: formData.get("discount"),
    discountReason: formData.get("discountReason"),
    internalNote: formData.get("internalNote"),
    productIds: formData.getAll("productId"),
    variantIds: formData.getAll("variantId"),
    quantities: formData.getAll("quantity"),
  });
  if (!result.success) {
    return {
      success: false,
      message: "Revisa los datos del cliente, entrega y partidas.",
    };
  }
  const shipping = parseMoneyToMinorUnits(result.data.shipping);
  const discount = parseMoneyToMinorUnits(result.data.discount);
  if (shipping === null || discount === null) {
    return {
      success: false,
      message: "Envío y descuento deben ser importes válidos.",
    };
  }
  if (discount > 0 && !result.data.discountReason) {
    return { success: false, message: "El descuento requiere un motivo." };
  }
  if (discount === 0 && result.data.discountReason) {
    return {
      success: false,
      message: "El motivo requiere un descuento mayor a cero.",
    };
  }
  return {
    success: true,
    data: {
      customer_name: result.data.customerName,
      customer_email: result.data.customerEmail || null,
      customer_phone: result.data.customerPhone,
      origin_channel: result.data.originChannel,
      origin_channel_detail: result.data.originChannelDetail,
      address: {
        recipient_name: result.data.recipientName,
        phone: result.data.recipientPhone,
        street: result.data.street,
        exterior_number: result.data.exteriorNumber,
        interior_number: result.data.interiorNumber,
        neighborhood: result.data.neighborhood,
        city: result.data.city,
        state: result.data.state,
        postal_code: result.data.postalCode,
        references: result.data.references,
      },
      shipping_total: shipping,
      discount_total: discount,
      discount_reason: result.data.discountReason,
      internal_note: result.data.internalNote,
      items: result.data.productIds.map((productId, index) => ({
        product_id: productId,
        variant_id: result.data.variantIds[index]!,
        quantity: result.data.quantities[index]!,
      })),
    },
  };
}

export function validateVariantRelationship(
  productId: string,
  variantId: string,
  options: readonly { productId: string; variantId: string }[],
) {
  return options.some(
    (option) =>
      option.productId === productId && option.variantId === variantId,
  );
}
