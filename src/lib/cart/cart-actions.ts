"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  cartQuantitySchema,
  checkoutAddressSchema,
  checkoutAddressToPayload,
} from "@/lib/cart/cart-rules";
import type { CartActionResult } from "@/lib/cart/cart-action-state";
import { getSafeInternalPath } from "@/lib/auth/redirect";
import { getAuthenticatedUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

const uuid = z.uuid();
const version = z.coerce.number().int().positive();

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function requireCartUser(returnTo: string) {
  const user = await getAuthenticatedUser();
  if (!user) {
    const safe = getSafeInternalPath(returnTo, "/productos");
    redirect(`/iniciar-sesion?next=${encodeURIComponent(safe)}`);
  }
  return user;
}

function safeFailure(code?: string): CartActionResult {
  if (code === "40001") {
    return {
      status: "error",
      message: "El carrito cambió. Revísalo antes de continuar.",
    };
  }
  if (code === "23514") {
    return {
      status: "error",
      message: "La cantidad solicitada ya no está disponible.",
    };
  }
  if (code === "23505") {
    return {
      status: "error",
      message:
        "La solicitud se reutilizó con datos distintos. Recarga la página.",
    };
  }
  if (code === "P0002") {
    return {
      status: "error",
      message: "El carrito o la partida ya no está disponible.",
    };
  }
  if (code === "22023") {
    return {
      status: "error",
      message: "El producto, la cantidad o los datos ya no son válidos.",
    };
  }
  return {
    status: "error",
    message: "No pudimos actualizar el carrito. Inténtalo nuevamente.",
  };
}

export async function addToCartAction(
  _state: CartActionResult,
  formData: FormData,
): Promise<CartActionResult> {
  const slug = text(formData, "slug");
  await requireCartUser(
    getSafeInternalPath(`/productos/${slug}`, "/productos"),
  );
  const productId = uuid.safeParse(text(formData, "productId"));
  const variantId = uuid.safeParse(text(formData, "variantId"));
  const quantity = cartQuantitySchema.safeParse(text(formData, "quantity"));
  const key = uuid.safeParse(text(formData, "idempotencyKey"));
  if (
    !productId.success ||
    !variantId.success ||
    !quantity.success ||
    !key.success
  ) {
    return {
      status: "error",
      message: "Selecciona una variante y cantidad válidas.",
    };
  }
  const client = await createClient();
  const { error } = await client.rpc("add_customer_cart_item", {
    requested_product_id: productId.data,
    requested_variant_id: variantId.data,
    requested_quantity: quantity.data,
    requested_idempotency_key: key.data,
  });
  if (error) return safeFailure(error.code);
  revalidatePath("/carrito");
  revalidatePath("/checkout");
  revalidatePath(`/productos/${slug}`);
  return {
    status: "success",
    message: "Producto agregado. Puedes seguir comprando o ir al carrito.",
  };
}

export async function changeCartItemAction(
  _state: CartActionResult,
  formData: FormData,
): Promise<CartActionResult> {
  await requireCartUser("/carrito");
  const itemId = uuid.safeParse(text(formData, "itemId"));
  const parsedVersion = version.safeParse(text(formData, "version"));
  const quantity = cartQuantitySchema.safeParse(text(formData, "quantity"));
  const key = uuid.safeParse(text(formData, "idempotencyKey"));
  if (
    !itemId.success ||
    !parsedVersion.success ||
    !quantity.success ||
    !key.success
  ) {
    return {
      status: "error",
      message: "La cantidad debe ser un entero entre 1 y 99.",
    };
  }
  const client = await createClient();
  const { error } = await client.rpc("change_customer_cart", {
    requested_operation: "update",
    requested_cart_item_id: itemId.data,
    requested_quantity: quantity.data,
    expected_version: parsedVersion.data,
    requested_idempotency_key: key.data,
  });
  if (error) return safeFailure(error.code);
  revalidatePath("/carrito");
  revalidatePath("/checkout");
  return {
    status: "success",
    message: "Cantidad actualizada con el precio vigente.",
  };
}

export async function removeCartItemAction(
  _state: CartActionResult,
  formData: FormData,
): Promise<CartActionResult> {
  await requireCartUser("/carrito");
  const itemId = uuid.safeParse(text(formData, "itemId"));
  const parsedVersion = version.safeParse(text(formData, "version"));
  const key = uuid.safeParse(text(formData, "idempotencyKey"));
  if (!itemId.success || !parsedVersion.success || !key.success) {
    return { status: "error", message: "La partida ya no es válida." };
  }
  const client = await createClient();
  const { error } = await client.rpc("change_customer_cart", {
    requested_operation: "remove",
    requested_cart_item_id: itemId.data,
    requested_quantity: 1,
    expected_version: parsedVersion.data,
    requested_idempotency_key: key.data,
  });
  if (error) return safeFailure(error.code);
  revalidatePath("/carrito");
  revalidatePath("/checkout");
  return { status: "success", message: "Partida eliminada." };
}

export async function clearCartAction(
  _state: CartActionResult,
  formData: FormData,
): Promise<CartActionResult> {
  await requireCartUser("/carrito");
  const parsedVersion = version.safeParse(text(formData, "version"));
  const key = uuid.safeParse(text(formData, "idempotencyKey"));
  if (!parsedVersion.success || !key.success) {
    return {
      status: "error",
      message: "El carrito cambió. Recarga la página.",
    };
  }
  const client = await createClient();
  const { error } = await client.rpc("clear_customer_cart", {
    expected_version: parsedVersion.data,
    requested_idempotency_key: key.data,
  });
  if (error) return safeFailure(error.code);
  revalidatePath("/carrito");
  revalidatePath("/checkout");
  return { status: "success", message: "Carrito vaciado." };
}

export async function checkoutAction(
  _state: CartActionResult,
  formData: FormData,
): Promise<CartActionResult> {
  await requireCartUser("/checkout");
  const cartId = uuid.safeParse(text(formData, "cartId"));
  const shippingMethodId = uuid.safeParse(text(formData, "shippingMethodId"));
  const parsedVersion = version.safeParse(text(formData, "version"));
  const key = uuid.safeParse(text(formData, "idempotencyKey"));
  const savedAddressValue = text(formData, "savedAddressId");
  const savedAddressId = savedAddressValue
    ? uuid.safeParse(savedAddressValue)
    : null;
  const address = checkoutAddressSchema.safeParse({
    recipientName: text(formData, "recipientName"),
    phone: text(formData, "phone"),
    street: text(formData, "street"),
    exteriorNumber: text(formData, "exteriorNumber"),
    interiorNumber: text(formData, "interiorNumber"),
    neighborhood: text(formData, "neighborhood"),
    city: text(formData, "city"),
    state: text(formData, "state"),
    postalCode: text(formData, "postalCode"),
    references: text(formData, "references"),
  });
  if (
    !cartId.success ||
    !shippingMethodId.success ||
    !parsedVersion.success ||
    !key.success ||
    (savedAddressId !== null && !savedAddressId.success) ||
    (savedAddressId === null && !address.success)
  ) {
    return {
      status: "error",
      message: "Revisa la dirección de envío y vuelve a intentarlo.",
    };
  }
  const client = await createClient();
  const { data, error } = await client.rpc("create_customer_checkout_order", {
    requested_cart_id: cartId.data,
    expected_version: parsedVersion.data,
    requested_shipping_method_id: shippingMethodId.data,
    requested_saved_address_id: savedAddressId?.data ?? null,
    requested_address: address.success
      ? checkoutAddressToPayload(address.data)
      : {},
    requested_save_address:
      savedAddressId === null && formData.get("saveAddress") === "on",
    requested_idempotency_key: key.data,
  });
  if (error || !data[0]) return safeFailure(error?.code);
  revalidatePath("/carrito");
  revalidatePath("/checkout");
  revalidatePath("/cuenta/pedidos");
  revalidatePath("/operacion/pedidos");
  redirect(`/pedido-confirmado/${data[0].order_id}`);
}
