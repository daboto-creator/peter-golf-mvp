import "server-only";

import { z } from "zod";

import { optionalNonEmptyString, parseEnvironment } from "@/env/shared";
import { publicEnv } from "@/env/public";

const emptyAsUndefined = <TSchema extends z.ZodType>(schema: TSchema) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema);

const notificationEmailEnvironmentSchema = z.object({
  EMAIL_TRANSPORT: emptyAsUndefined(z.enum(["smtp"]).optional()),
  SMTP_HOST: emptyAsUndefined(z.string().trim().min(1).optional()),
  SMTP_PORT: emptyAsUndefined(
    z.coerce.number().int().min(1).max(65535).optional(),
  ),
  SMTP_SECURE: emptyAsUndefined(
    z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  ),
  EMAIL_FROM_ADDRESS: emptyAsUndefined(z.email().optional()),
  EMAIL_FROM_NAME: emptyAsUndefined(
    z.string().trim().min(1).max(120).optional(),
  ),
  EMAIL_ALLOWED_RECIPIENT_DOMAINS: emptyAsUndefined(
    z
      .string()
      .transform((value) =>
        value
          .split(",")
          .map((domain) => domain.trim().toLowerCase())
          .filter(Boolean),
      )
      .pipe(z.array(z.string().regex(/^[a-z0-9.-]+$/)).min(1))
      .optional(),
  ),
});

const defaultAppEnvironment =
  process.env.NODE_ENV === "production"
    ? undefined
    : process.env.NODE_ENV === "test"
      ? "test"
      : "development";

const serverEnvironmentSchema = z.object({
  APP_ENV: z.enum(["development", "test", "preview", "staging", "production"]),
  MARKETPLACE_ENABLED: emptyAsUndefined(
    z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .default(false),
  ),
  PAYMENTS_MODE: z.enum(["disabled", "test"]).default("disabled"),
  STRIPE_CHECKOUT_MODE: z.enum(["disabled", "test"]).default("disabled"),
  STRIPE_SECRET_KEY: optionalNonEmptyString,
  STRIPE_WEBHOOK_SECRET: optionalNonEmptyString,
  NOTIFICATIONS_MODE: z.enum(["disabled", "test"]).default("disabled"),
  SUPABASE_SERVICE_ROLE_KEY: optionalNonEmptyString,
  MARKET_PRICE_PROVIDER: emptyAsUndefined(
    z.enum(["serpapi", "unavailable"]).default("unavailable"),
  ),
  SERPAPI_API_KEY: optionalNonEmptyString,
  ...notificationEmailEnvironmentSchema.shape,
});

export type NotificationEmailConfig = {
  EMAIL_TRANSPORT: "smtp";
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  EMAIL_FROM_ADDRESS: string;
  EMAIL_FROM_NAME: string;
  EMAIL_ALLOWED_RECIPIENT_DOMAINS: string[];
};

const localNotificationEmailDefaults: NotificationEmailConfig = {
  EMAIL_TRANSPORT: "smtp",
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: 54325,
  SMTP_SECURE: false,
  EMAIL_FROM_ADDRESS: "no-reply@peter-golf.test",
  EMAIL_FROM_NAME: "Best Round Pro Shop",
  EMAIL_ALLOWED_RECIPIENT_DOMAINS: ["example.test", "peter-golf.test"],
};

const rawServerEnvironment = {
  APP_ENV: process.env.APP_ENV || defaultAppEnvironment,
  MARKETPLACE_ENABLED: process.env.MARKETPLACE_ENABLED,
  PAYMENTS_MODE: process.env.PAYMENTS_MODE,
  STRIPE_CHECKOUT_MODE: process.env.STRIPE_CHECKOUT_MODE,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  NOTIFICATIONS_MODE: process.env.NOTIFICATIONS_MODE,
  EMAIL_TRANSPORT: process.env.EMAIL_TRANSPORT,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_SECURE: process.env.SMTP_SECURE,
  EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS,
  EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME,
  EMAIL_ALLOWED_RECIPIENT_DOMAINS: process.env.EMAIL_ALLOWED_RECIPIENT_DOMAINS,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  MARKET_PRICE_PROVIDER: process.env.MARKET_PRICE_PROVIDER,
  SERPAPI_API_KEY: process.env.SERPAPI_API_KEY,
};

const parsedServerEnvironment = parseEnvironment(
  serverEnvironmentSchema,
  rawServerEnvironment,
  "server",
);

const usesLocalNotificationDefaults =
  parsedServerEnvironment.APP_ENV === "development" ||
  parsedServerEnvironment.APP_ENV === "test";

const resolvedServerEnvironment = {
  ...parsedServerEnvironment,
  ...(usesLocalNotificationDefaults
    ? {
        EMAIL_TRANSPORT:
          parsedServerEnvironment.EMAIL_TRANSPORT ??
          localNotificationEmailDefaults.EMAIL_TRANSPORT,
        SMTP_HOST:
          parsedServerEnvironment.SMTP_HOST ??
          localNotificationEmailDefaults.SMTP_HOST,
        SMTP_PORT:
          parsedServerEnvironment.SMTP_PORT ??
          localNotificationEmailDefaults.SMTP_PORT,
        SMTP_SECURE:
          parsedServerEnvironment.SMTP_SECURE ??
          localNotificationEmailDefaults.SMTP_SECURE,
        EMAIL_FROM_ADDRESS:
          parsedServerEnvironment.EMAIL_FROM_ADDRESS ??
          localNotificationEmailDefaults.EMAIL_FROM_ADDRESS,
        EMAIL_FROM_NAME:
          parsedServerEnvironment.EMAIL_FROM_NAME ??
          localNotificationEmailDefaults.EMAIL_FROM_NAME,
        EMAIL_ALLOWED_RECIPIENT_DOMAINS:
          parsedServerEnvironment.EMAIL_ALLOWED_RECIPIENT_DOMAINS ??
          localNotificationEmailDefaults.EMAIL_ALLOWED_RECIPIENT_DOMAINS,
      }
    : {}),
};

function resolveNotificationEmailConfig(): NotificationEmailConfig | undefined {
  const environment = resolvedServerEnvironment;

  if (
    !environment.EMAIL_TRANSPORT ||
    !environment.SMTP_HOST ||
    environment.SMTP_PORT === undefined ||
    environment.SMTP_SECURE === undefined ||
    !environment.EMAIL_FROM_ADDRESS ||
    !environment.EMAIL_FROM_NAME ||
    !environment.EMAIL_ALLOWED_RECIPIENT_DOMAINS
  ) {
    return undefined;
  }

  return {
    EMAIL_TRANSPORT: environment.EMAIL_TRANSPORT,
    SMTP_HOST: environment.SMTP_HOST,
    SMTP_PORT: environment.SMTP_PORT,
    SMTP_SECURE: environment.SMTP_SECURE,
    EMAIL_FROM_ADDRESS: environment.EMAIL_FROM_ADDRESS,
    EMAIL_FROM_NAME: environment.EMAIL_FROM_NAME,
    EMAIL_ALLOWED_RECIPIENT_DOMAINS:
      environment.EMAIL_ALLOWED_RECIPIENT_DOMAINS,
  };
}

export const notificationEmailConfig = resolveNotificationEmailConfig();

function isHostedHttpsUrl(value: string | undefined) {
  if (!value) return false;

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const isLocalhost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.endsWith(".localhost");

    return url.protocol === "https:" && !isLocalhost;
  } catch {
    return false;
  }
}

function assertHostedEnvironment() {
  const invalidFields: string[] = [];
  const hostedEnvironment = ["preview", "staging", "production"].includes(
    resolvedServerEnvironment.APP_ENV,
  );

  const forbiddenMailFields = [
    "EMAIL_TRANSPORT",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_SECURE",
    "EMAIL_FROM_ADDRESS",
    "EMAIL_FROM_NAME",
    "EMAIL_ALLOWED_RECIPIENT_DOMAINS",
  ] as const;

  const stripeSecretFields = [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
  ] as const;

  if (resolvedServerEnvironment.STRIPE_CHECKOUT_MODE === "test") {
    if (resolvedServerEnvironment.PAYMENTS_MODE !== "test") {
      invalidFields.push("PAYMENTS_MODE");
    }
    if (!resolvedServerEnvironment.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
      invalidFields.push("STRIPE_SECRET_KEY");
    }
    if (
      !resolvedServerEnvironment.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")
    ) {
      invalidFields.push("STRIPE_WEBHOOK_SECRET");
    }
    if (!resolvedServerEnvironment.SUPABASE_SERVICE_ROLE_KEY) {
      invalidFields.push("SUPABASE_SERVICE_ROLE_KEY");
    }
  } else {
    for (const field of stripeSecretFields) {
      if (rawServerEnvironment[field]?.trim()) invalidFields.push(field);
    }
    if (resolvedServerEnvironment.SUPABASE_SERVICE_ROLE_KEY) {
      invalidFields.push("SUPABASE_SERVICE_ROLE_KEY");
    }
  }

  if (resolvedServerEnvironment.STRIPE_SECRET_KEY?.startsWith("sk_live_")) {
    invalidFields.push("STRIPE_SECRET_KEY");
  }

  if (hostedEnvironment) {
    if (!isHostedHttpsUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL)) {
      invalidFields.push("NEXT_PUBLIC_SUPABASE_URL");
    }
    if (!publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      invalidFields.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
    if (!isHostedHttpsUrl(publicEnv.NEXT_PUBLIC_APP_URL)) {
      invalidFields.push("NEXT_PUBLIC_APP_URL");
    }
    if (resolvedServerEnvironment.NOTIFICATIONS_MODE !== "disabled") {
      invalidFields.push("NOTIFICATIONS_MODE");
    }
    for (const field of forbiddenMailFields) {
      if (rawServerEnvironment[field]?.trim()) invalidFields.push(field);
    }
  }

  if (
    resolvedServerEnvironment.APP_ENV === "preview" ||
    resolvedServerEnvironment.APP_ENV === "production"
  ) {
    if (resolvedServerEnvironment.PAYMENTS_MODE !== "disabled") {
      invalidFields.push("PAYMENTS_MODE");
    }
    if (resolvedServerEnvironment.STRIPE_CHECKOUT_MODE !== "disabled") {
      invalidFields.push("STRIPE_CHECKOUT_MODE");
    }
    for (const field of stripeSecretFields) {
      if (rawServerEnvironment[field]?.trim()) invalidFields.push(field);
    }
    if (resolvedServerEnvironment.SUPABASE_SERVICE_ROLE_KEY) {
      invalidFields.push("SUPABASE_SERVICE_ROLE_KEY");
    }
  }

  if (
    resolvedServerEnvironment.APP_ENV === "staging" &&
    resolvedServerEnvironment.STRIPE_CHECKOUT_MODE === "disabled" &&
    resolvedServerEnvironment.PAYMENTS_MODE !== "disabled"
  ) {
    invalidFields.push("PAYMENTS_MODE");
  }

  if (
    resolvedServerEnvironment.NOTIFICATIONS_MODE === "test" &&
    !notificationEmailConfig
  ) {
    for (const field of forbiddenMailFields) {
      if (resolvedServerEnvironment[field] === undefined) {
        invalidFields.push(field);
      }
    }
  }

  if (
    resolvedServerEnvironment.MARKET_PRICE_PROVIDER === "serpapi" &&
    !resolvedServerEnvironment.SERPAPI_API_KEY
  ) {
    invalidFields.push("SERPAPI_API_KEY");
  }

  if (invalidFields.length > 0) {
    throw new Error(
      `Invalid server environment configuration: ${[
        ...new Set(invalidFields),
      ].join(", ")}.`,
    );
  }
}

assertHostedEnvironment();

export const serverEnv = {
  ...publicEnv,
  ...resolvedServerEnvironment,
};
