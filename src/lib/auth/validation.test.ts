import { describe, expect, it } from "vitest";

import {
  loginSchema,
  profileSchema,
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

  it("validates and normalizes customer profile fields", () => {
    expect(
      profileSchema.parse({
        firstName: " Ana ",
        lastName: " Pérez ",
        phone: " 442 123 4567 ",
      }),
    ).toEqual({ firstName: "Ana", lastName: "Pérez", phone: "442 123 4567" });
    expect(
      profileSchema.safeParse({
        firstName: "Ana",
        lastName: "Pérez",
        phone: "123",
      }).success,
    ).toBe(false);
  });
});
