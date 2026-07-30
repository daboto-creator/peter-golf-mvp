import { describe, expect, it } from "vitest";

import { resolveCatalogAuthorization } from "@/lib/auth/authorization-state";

describe("catalog authorization", () => {
  it("requires authentication before considering catalog permission", () => {
    expect(resolveCatalogAuthorization(null, true)).toBe("unauthenticated");
  });

  it("denies an authenticated user without catalog permission", () => {
    expect(resolveCatalogAuthorization("user-id", false)).toBe("forbidden");
  });

  it("allows an authenticated operator or admin permission result", () => {
    expect(resolveCatalogAuthorization("user-id", true)).toBe("authorized");
  });
});
