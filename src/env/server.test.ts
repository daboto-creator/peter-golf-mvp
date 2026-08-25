import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mailFields = [
  "EMAIL_TRANSPORT",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "EMAIL_FROM_ADDRESS",
  "EMAIL_FROM_NAME",
  "EMAIL_ALLOWED_RECIPIENT_DOMAINS",
] as const;

function setBaseEnvironment(
  appEnvironment: "development" | "preview" | "staging" | "production",
) {
  vi.stubEnv("APP_ENV", appEnvironment);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "synthetic-publishable-key");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.example.test");
  vi.stubEnv("MARKETPLACE_ENABLED", "false");
  vi.stubEnv("PAYMENTS_MODE", "disabled");
  vi.stubEnv("STRIPE_CHECKOUT_MODE", "disabled");
  vi.stubEnv("STRIPE_SECRET_KEY", "");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
  vi.stubEnv("NOTIFICATIONS_MODE", "disabled");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  for (const field of mailFields) vi.stubEnv(field, "");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("server environment", () => {
  test("accepts a valid Preview configuration without local email defaults", async () => {
    setBaseEnvironment("preview");

    const { notificationEmailConfig, serverEnv } = await import("./server");

    expect(serverEnv.APP_ENV).toBe("preview");
    expect(serverEnv.MARKETPLACE_ENABLED).toBe(false);
    expect(serverEnv.PAYMENTS_MODE).toBe("disabled");
    expect(serverEnv.STRIPE_CHECKOUT_MODE).toBe("disabled");
    expect(notificationEmailConfig).toBeUndefined();
    for (const field of mailFields) expect(serverEnv[field]).toBeUndefined();
  });

  test("rejects localhost URLs in Preview", async () => {
    setBaseEnvironment("preview");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");

    await expect(import("./server")).rejects.toThrow(
      "Invalid server environment configuration: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_APP_URL.",
    );
  });

  test("rejects Stripe test mode in Preview", async () => {
    setBaseEnvironment("preview");
    vi.stubEnv("PAYMENTS_MODE", "test");
    vi.stubEnv("STRIPE_CHECKOUT_MODE", "test");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_preview_forbidden");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_preview_forbidden");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "preview-service-role-forbidden");

    await expect(import("./server")).rejects.toThrow(
      /PAYMENTS_MODE, STRIPE_CHECKOUT_MODE, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  test("rejects a service role in Preview", async () => {
    setBaseEnvironment("preview");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "preview-service-role-forbidden");

    await expect(import("./server")).rejects.toThrow(
      "Invalid server environment configuration: SUPABASE_SERVICE_ROLE_KEY.",
    );
  });

  test("rejects SMTP configuration in Preview without exposing its value", async () => {
    setBaseEnvironment("preview");
    vi.stubEnv("SMTP_HOST", "should-not-appear.example.test");

    await expect(import("./server")).rejects.toThrow(
      "Invalid server environment configuration: SMTP_HOST.",
    );
  });

  test("accepts staging with Stripe and payments disabled", async () => {
    setBaseEnvironment("staging");

    const { notificationEmailConfig, serverEnv } = await import("./server");

    expect(serverEnv.PAYMENTS_MODE).toBe("disabled");
    expect(serverEnv.STRIPE_CHECKOUT_MODE).toBe("disabled");
    expect(notificationEmailConfig).toBeUndefined();
    for (const field of mailFields) expect(serverEnv[field]).toBeUndefined();
  });

  test("parses the server-only Marketplace feature flag", async () => {
    setBaseEnvironment("development");
    vi.stubEnv("MARKETPLACE_ENABLED", "true");

    const { serverEnv } = await import("./server");

    expect(serverEnv.MARKETPLACE_ENABLED).toBe(true);
  });

  test("rejects configured email fields in staging without exposing values", async () => {
    setBaseEnvironment("staging");
    vi.stubEnv("SMTP_HOST", "should-not-appear.example.test");

    await expect(import("./server")).rejects.toThrow(
      "Invalid server environment configuration: SMTP_HOST.",
    );
  });

  test("preserves local Inbucket defaults in development", async () => {
    setBaseEnvironment("development");

    const { notificationEmailConfig, serverEnv } = await import("./server");

    expect(notificationEmailConfig).toEqual({
      EMAIL_TRANSPORT: "smtp",
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: 54325,
      SMTP_SECURE: false,
      EMAIL_FROM_ADDRESS: "no-reply@peter-golf.test",
      EMAIL_FROM_NAME: "Best Round Pro Shop",
      EMAIL_ALLOWED_RECIPIENT_DOMAINS: ["example.test", "peter-golf.test"],
    });
    expect(serverEnv.SMTP_HOST).toBe("127.0.0.1");
  });

  test("fails closed when hosted notifications are enabled", async () => {
    setBaseEnvironment("production");
    vi.stubEnv("NOTIFICATIONS_MODE", "test");

    await expect(import("./server")).rejects.toThrow(
      /Invalid server environment configuration: NOTIFICATIONS_MODE/,
    );
  });

  test("accepts complete Stripe test configuration in staging", async () => {
    setBaseEnvironment("staging");
    vi.stubEnv("PAYMENTS_MODE", "test");
    vi.stubEnv("STRIPE_CHECKOUT_MODE", "test");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_synthetic");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_synthetic");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-service-role");

    const { serverEnv } = await import("./server");

    expect(serverEnv.STRIPE_CHECKOUT_MODE).toBe("test");
    expect(serverEnv.PAYMENTS_MODE).toBe("test");
  });

  test("rejects live keys without exposing their value", async () => {
    setBaseEnvironment("development");
    vi.stubEnv("PAYMENTS_MODE", "test");
    vi.stubEnv("STRIPE_CHECKOUT_MODE", "test");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_must_never_appear");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_synthetic");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-service-role");

    await expect(import("./server")).rejects.toThrow(
      "Invalid server environment configuration: STRIPE_SECRET_KEY.",
    );
  });

  test("rejects Stripe test mode in production", async () => {
    setBaseEnvironment("production");
    vi.stubEnv("PAYMENTS_MODE", "test");
    vi.stubEnv("STRIPE_CHECKOUT_MODE", "test");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_production_forbidden");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_production_forbidden");
    vi.stubEnv(
      "SUPABASE_SERVICE_ROLE_KEY",
      "production-service-role-forbidden",
    );

    await expect(import("./server")).rejects.toThrow(
      /PAYMENTS_MODE, STRIPE_CHECKOUT_MODE, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  test("rejects Stripe secrets while the integration is disabled", async () => {
    setBaseEnvironment("development");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_should_not_be_configured");

    await expect(import("./server")).rejects.toThrow(
      "Invalid server environment configuration: STRIPE_SECRET_KEY.",
    );
  });

  test("requires explicit APP_ENV in a production runtime", async () => {
    setBaseEnvironment("production");
    vi.stubEnv("APP_ENV", "");
    vi.stubEnv("NODE_ENV", "production");

    await expect(import("./server")).rejects.toThrow(
      "Invalid server environment variables: APP_ENV.",
    );
  });
});
