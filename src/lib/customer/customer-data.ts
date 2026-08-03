import "server-only";

import { createClient } from "@/lib/supabase/server";

export type CustomerAddress = {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  street: string;
  exteriorNumber: string;
  interiorNumber: string | null;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  references: string | null;
  isDefault: boolean;
  version: number;
};

export async function getCustomerAddresses(): Promise<
  CustomerAddress[] | null
> {
  try {
    const client = await createClient();
    const { data, error } = await client
      .from("addresses")
      .select(
        "id,label,recipient_name,phone,line_1,exterior_number,line_2,neighborhood,city,state,postal_code,delivery_references,is_default,version",
      )
      .is("archived_at", null)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) return null;
    return data.map((address) => ({
      id: address.id,
      label: address.label,
      recipientName: address.recipient_name,
      phone: address.phone ?? "",
      street: address.line_1,
      exteriorNumber: address.exterior_number ?? "",
      interiorNumber: address.line_2,
      neighborhood: address.neighborhood ?? "",
      city: address.city,
      state: address.state,
      postalCode: address.postal_code,
      references: address.delivery_references,
      isDefault: address.is_default,
      version: address.version,
    }));
  } catch {
    return null;
  }
}

export async function getCustomerAddress(
  id: string,
): Promise<CustomerAddress | null> {
  const addresses = await getCustomerAddresses();
  return addresses?.find((address) => address.id === id) ?? null;
}
