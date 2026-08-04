import "server-only";

import { z } from "zod";

import { optionalNonEmptyString, parseEnvironment } from "@/env/shared";
import { publicEnv } from "@/env/public";

const serverEnvironmentSchema = z.object({
  APP_ENV: z
    .enum(["development", "test", "staging", "production"])
    .default("development"),
  PAYMENTS_MODE: z.enum(["disabled", "test"]).default("disabled"),
  NOTIFICATIONS_MODE: z.enum(["disabled", "test"]).default("disabled"),
  EMAIL_TRANSPORT: z.enum(["smtp"]).default("smtp"),
  SMTP_HOST: z.string().trim().min(1).default("127.0.0.1"),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(54325),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  EMAIL_FROM_ADDRESS: z.email().default("no-reply@peter-golf.test"),
  EMAIL_FROM_NAME: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .default("Peter Golf Pruebas"),
  EMAIL_ALLOWED_RECIPIENT_DOMAINS: z
    .string()
    .default("example.test,peter-golf.test")
    .transform((value) =>
      value
        .split(",")
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().regex(/^[a-z0-9.-]+$/)).min(1)),
  SUPABASE_SERVICE_ROLE_KEY: optionalNonEmptyString,
});

export const serverEnv = {
  ...publicEnv,
  ...parseEnvironment(
    serverEnvironmentSchema,
    {
      APP_ENV: process.env.APP_ENV,
      PAYMENTS_MODE: process.env.PAYMENTS_MODE,
      NOTIFICATIONS_MODE: process.env.NOTIFICATIONS_MODE,
      EMAIL_TRANSPORT: process.env.EMAIL_TRANSPORT,
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_PORT: process.env.SMTP_PORT,
      SMTP_SECURE: process.env.SMTP_SECURE,
      EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS,
      EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME,
      EMAIL_ALLOWED_RECIPIENT_DOMAINS:
        process.env.EMAIL_ALLOWED_RECIPIENT_DOMAINS,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    "server",
  ),
};
