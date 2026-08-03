import { z } from "zod";

const nameField = z
  .string()
  .trim()
  .min(1, "Este campo es obligatorio.")
  .max(80, "Usa 80 caracteres o menos.");

export const emailSchema = z
  .string()
  .trim()
  .max(254, "El correo es demasiado largo.")
  .pipe(z.email("Escribe un correo electrónico válido."))
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(10, "Usa al menos 10 caracteres.")
  .max(72, "Usa 72 caracteres o menos.")
  .regex(/[a-záéíóúüñ]/, "Incluye al menos una letra minúscula.")
  .regex(/[A-ZÁÉÍÓÚÜÑ]/, "Incluye al menos una letra mayúscula.")
  .regex(/[0-9]/, "Incluye al menos un número.")
  .regex(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]/, "Incluye al menos un símbolo.");

export const registerSchema = z
  .object({
    firstName: nameField,
    lastName: nameField,
    email: emailSchema,
    password: passwordSchema,
    passwordConfirmation: z.string(),
    acceptedTerms: z.boolean().refine((value) => value, {
      message: "Debes aceptar el aviso de privacidad y los términos.",
    }),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "Las contraseñas no coinciden.",
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Escribe tu contraseña."),
  next: z.string().optional(),
});

export const recoveryRequestSchema = z.object({
  email: emailSchema,
});

export const updatePasswordSchema = z
  .object({
    password: passwordSchema,
    passwordConfirmation: z.string(),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "Las contraseñas no coinciden.",
  });

export const profileSchema = z.object({
  firstName: nameField,
  lastName: nameField,
  phone: z
    .string()
    .transform((value) => value.trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(7, "Usa entre 7 y 30 caracteres.")
        .max(30, "Usa entre 7 y 30 caracteres."),
    ),
});

export type RegisterValues = z.input<typeof registerSchema>;
export type LoginValues = z.input<typeof loginSchema>;
export type RecoveryRequestValues = z.input<typeof recoveryRequestSchema>;
export type UpdatePasswordValues = z.input<typeof updatePasswordSchema>;
export type ProfileValues = z.input<typeof profileSchema>;
