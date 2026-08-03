import { z } from "zod";

const normalizedRequired = (
  minimum: number,
  maximum: number,
  message: string,
) =>
  z
    .string()
    .transform((value) => value.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(minimum, message).max(maximum, message));

const optionalText = (maximum: number) =>
  z
    .string()
    .transform((value) => value.trim().replace(/\s+/g, " "))
    .pipe(z.string().max(maximum))
    .transform((value) => value || null);

export const addressSchema = z.object({
  label: normalizedRequired(2, 40, "Usa entre 2 y 40 caracteres."),
  recipientName: normalizedRequired(2, 120, "Usa entre 2 y 120 caracteres."),
  phone: normalizedRequired(7, 30, "Usa entre 7 y 30 caracteres."),
  street: normalizedRequired(1, 160, "Escribe la calle."),
  exteriorNumber: normalizedRequired(1, 30, "Escribe el número exterior."),
  interiorNumber: optionalText(30),
  neighborhood: normalizedRequired(1, 120, "Escribe la colonia."),
  city: normalizedRequired(1, 120, "Escribe la ciudad o municipio."),
  state: normalizedRequired(1, 120, "Escribe el estado."),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "El código postal debe tener 5 dígitos."),
  references: optionalText(500),
  isDefault: z.boolean(),
  countryCode: z.literal("MX"),
});

export type AddressValues = z.input<typeof addressSchema>;
export type NormalizedAddress = z.output<typeof addressSchema>;

export function addressToPayload(address: NormalizedAddress) {
  return {
    label: address.label,
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
    is_default: address.isDefault,
  };
}
