import { describe, expect, it } from "vitest";

import { getProductMutationCondition } from "@/lib/catalog/product-transition";

describe("product mutation conditions", () => {
  it.each([
    ["edit", "draft", false],
    ["publish", "draft", false],
    ["unpublish", "active", true],
    ["archive", "draft", false],
  ] as const)(
    "allows %s only from a consistent unarchived snapshot",
    (transition, status, published) => {
      expect(
        getProductMutationCondition(transition, {
          archivedAt: null,
          status,
          published,
        }),
      ).toEqual({
        archiveState: "unarchived",
        status,
        published,
      });

      expect(
        getProductMutationCondition(transition, {
          archivedAt: "2026-07-30T00:00:00.000Z",
          status: "archived",
          published: false,
        }),
      ).toBeNull();
    },
  );

  it("restores only a consistently archived snapshot", () => {
    expect(
      getProductMutationCondition("restore", {
        archivedAt: "2026-07-30T00:00:00.000Z",
        status: "archived",
        published: false,
      }),
    ).toEqual({
      archiveState: "archived",
      status: "archived",
      published: false,
    });

    expect(
      getProductMutationCondition("restore", {
        archivedAt: null,
        status: "draft",
        published: false,
      }),
    ).toBeNull();
  });

  it("rejects publication and unpublication no-ops", () => {
    expect(
      getProductMutationCondition("publish", {
        archivedAt: null,
        status: "active",
        published: true,
      }),
    ).toBeNull();
    expect(
      getProductMutationCondition("unpublish", {
        archivedAt: null,
        status: "draft",
        published: false,
      }),
    ).toBeNull();
  });

  it("rejects inconsistent archived fields in either direction", () => {
    expect(
      getProductMutationCondition("archive", {
        archivedAt: "2026-07-30T00:00:00.000Z",
        status: "draft",
        published: false,
      }),
    ).toBeNull();
    expect(
      getProductMutationCondition("restore", {
        archivedAt: null,
        status: "archived",
        published: false,
      }),
    ).toBeNull();
  });
});
