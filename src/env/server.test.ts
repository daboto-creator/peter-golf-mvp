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
  appEnvironment: "development" | "staging" | "production",
) {
  vi.stubEnv("APP_ENV", appEnvironment);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "synthetic-publishable-key");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.example.test");
  vi.stubEnv("PAYMENTS_MODE", "disabled");
  vi.stubEnv("NOTIFICATIONS_MODE", "disabled");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  for (const field of mailFields) vi.stubEnv(field, "");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("server environment", () => {
  test("keeps email configuration absent in staging", async () => {
    setBaseEnvironment("staging");

    const { notificationEmailConfig, serverEnv } = await import("./server");

    expect(notificationEmailConfig).toBeUndefined();
    for (const field of mailFields) expect(serverEnv[field]).toBeUndefined();
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
      EMAIL_FROM_NAME: "Peter Golf Pruebas",
      EMAIL_ALLOWED_RECIPIENT_DOMAINS: ["example.test", "peter-golf.test"],
    });
    expect(serverEnv.SMTP_HOST).toBe("127.0.0.1");
  });

  test("fails closed when production notifications are enabled", async () => {
    setBaseEnvironment("production");
    vi.stubEnv("NOTIFICATIONS_MODE", "test");

    await expect(import("./server")).rejects.toThrow(
      /Invalid server environment configuration: NOTIFICATIONS_MODE/,
    );
  });

  test("does not infer local email defaults in a production runtime", async () => {
    setBaseEnvironment("production");
    vi.stubEnv("APP_ENV", "");
    vi.stubEnv("NODE_ENV", "production");

    const { notificationEmailConfig, serverEnv } = await import("./server");

    expect(serverEnv.APP_ENV).toBe("production");
    expect(notificationEmailConfig).toBeUndefined();
    for (const field of mailFields) expect(serverEnv[field]).toBeUndefined();
  });
});
