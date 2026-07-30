import { describe, expect, it } from "vitest";

import { getSafeInternalPath } from "@/lib/auth/redirect";

describe("getSafeInternalPath", () => {
  it("allows internal paths with query strings", () => {
    expect(getSafeInternalPath("/cuenta/perfil?modo=edicion")).toBe(
      "/cuenta/perfil?modo=edicion",
    );
  });

  it.each([
    "https://evil.example/cuenta",
    "//evil.example/cuenta",
    "javascript:alert(1)",
    "cuenta",
  ])("rejects unsafe destination %s", (destination) => {
    expect(getSafeInternalPath(destination)).toBe("/cuenta");
  });
});
