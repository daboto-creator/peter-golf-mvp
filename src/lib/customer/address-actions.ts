"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth/user";
import type { AddressActionResult } from "@/lib/customer/address-action-state";
import { addressSchema, addressToPayload } from "@/lib/customer/address-rules";
import { createClient } from "@/lib/supabase/server";

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function safeFailure(code?: string): AddressActionResult {
  if (code === "40001")
    return {
      status: "error",
      message: "La dirección cambió. Recarga la página.",
    };
  if (code === "P0002")
    return { status: "error", message: "La dirección ya no está disponible." };
  if (code === "22023")
    return { status: "error", message: "Revisa los datos de la dirección." };
  return {
    status: "error",
    message: "No pudimos guardar la dirección. Inténtalo nuevamente.",
  };
}

async function hasSession() {
  return Boolean(await getAuthenticatedUser());
}

export async function saveAddressAction(
  _state: AddressActionResult,
  formData: FormData,
): Promise<AddressActionResult> {
  if (!(await hasSession()))
    return { status: "error", message: "Tu sesión ya no es válida." };
  const idValue = text(formData, "addressId");
  const id = idValue ? z.uuid().safeParse(idValue) : null;
  const versionValue = text(formData, "version");
  const version = versionValue
    ? z.coerce.number().int().positive().safeParse(versionValue)
    : null;
  if (
    (id && !id.success) ||
    (version && !version.success) ||
    Boolean(id) !== Boolean(version)
  ) {
    return { status: "error", message: "La dirección ya no es válida." };
  }
  const parsed = addressSchema.safeParse({
    label: text(formData, "label"),
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
    isDefault: formData.get("isDefault") === "on",
    countryCode: "MX",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisa los campos marcados.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }
  const client = await createClient();
  const { error } = await client.rpc("manage_customer_address", {
    requested_operation: id ? "update" : "create",
    requested_address_id: id?.data ?? null,
    expected_version: version?.data ?? null,
    requested_address: addressToPayload(parsed.data),
  });
  if (error) return safeFailure(error.code);
  revalidatePath("/cuenta");
  revalidatePath("/cuenta/direcciones");
  revalidatePath("/checkout");
  return {
    status: "success",
    message: id ? "Dirección actualizada." : "Dirección guardada.",
  };
}

async function mutateAddress(
  formData: FormData,
  operation: "delete" | "set_default",
) {
  if (!(await hasSession()))
    return {
      status: "error",
      message: "Tu sesión ya no es válida.",
    } satisfies AddressActionResult;
  const id = z.uuid().safeParse(text(formData, "addressId"));
  const version = z.coerce
    .number()
    .int()
    .positive()
    .safeParse(text(formData, "version"));
  if (!id.success || !version.success)
    return {
      status: "error",
      message: "La dirección ya no es válida.",
    } satisfies AddressActionResult;
  const client = await createClient();
  const { error } = await client.rpc("manage_customer_address", {
    requested_operation: operation,
    requested_address_id: id.data,
    expected_version: version.data,
    requested_address: {},
  });
  if (error) return safeFailure(error.code);
  revalidatePath("/cuenta/direcciones");
  revalidatePath("/checkout");
  return {
    status: "success",
    message:
      operation === "delete"
        ? "Dirección eliminada."
        : "Dirección predeterminada actualizada.",
  } satisfies AddressActionResult;
}

export async function deleteAddressAction(
  _state: AddressActionResult,
  formData: FormData,
) {
  return mutateAddress(formData, "delete");
}

export async function setDefaultAddressAction(
  _state: AddressActionResult,
  formData: FormData,
) {
  return mutateAddress(formData, "set_default");
}
