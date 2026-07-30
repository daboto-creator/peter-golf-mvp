import { describe, expect, it } from "vitest";

import {
  loginSchema,
  registerSchema,
  updatePasswordSchema,
} from "@/lib/auth/validation";

describe("authentication validation", () => {
  it("normalizes email addresses", () => {
    const result = loginSchema.parse({
      email: "  Persona@Example.COM ",
      password: "secret",
    });

    expect(result.email).toBe("persona@example.com");
  });

  it("requires matching robust passwords and accepted terms", () => {
    const result = registerSchema.safeParse({
      firstName: "Ana",
      lastName: "López",
      email: "ana@example.com",
      password: "debil",
      passwordConfirmation: "otra",
      acceptedTerms: false,
    });

    expect(result.success).toBe(false);
  });

  it("accepts a robust matching password", () => {
    expect(
      updatePasswordSchema.safeParse({
        password: "GolfSeguro#2026",
        passwordConfirmation: "GolfSeguro#2026",
      }).success,
    ).toBe(true);
  });
});
