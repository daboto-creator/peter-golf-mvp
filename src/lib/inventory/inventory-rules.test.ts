import { describe, expect, it } from "vitest";

import {
  calculateInventoryBalance,
  getInventoryLevel,
  isOperationalInventoryVariant,
  normalizeInventorySearchTerm,
  resolveInventoryMutationTarget,
  transformInventoryHistory,
  validateInventoryAdjustment,
} from "@/lib/inventory/inventory-rules";

const manageableProduct = {
  id: "41000000-0000-4000-8000-000000000001",
  status: "active" as const,
  archivedAt: null,
  variants: [
    {
      id: "51000000-0000-4000-8000-000000000001",
      active: true,
      archivedAt: null,
    },
  ],
};

const validAdjustment = {
  movementType: "adjustment",
  quantityDelta: 2,
  reason: "Conteo físico corregido",
  referenceType: "",
  referenceId: "",
  idempotencyKey: "10000000-0000-4000-8000-000000000001",
};

describe("inventory adjustment rules", () => {
  it("accepts integer receipts and adjustments with a note", () => {
    expect(validateInventoryAdjustment(validAdjustment).success).toBe(true);
    expect(
      validateInventoryAdjustment({
        ...validAdjustment,
        movementType: "receipt",
        quantityDelta: 4,
      }).success,
    ).toBe(true);
  });

  it("rejects zero, decimals, negative receipts and unsupported types", () => {
    for (const changes of [
      { quantityDelta: 0 },
      { quantityDelta: 1.5 },
      { movementType: "receipt", quantityDelta: -1 },
      { movementType: "sale" },
    ]) {
      expect(
        validateInventoryAdjustment({ ...validAdjustment, ...changes }).success,
      ).toBe(false);
    }
  });

  it("requires a meaningful note and complete optional reference", () => {
    expect(
      validateInventoryAdjustment({ ...validAdjustment, reason: "x" }).success,
    ).toBe(false);
    expect(
      validateInventoryAdjustment({
        ...validAdjustment,
        referenceType: "conteo",
      }).success,
    ).toBe(false);
  });

  it("calculates balances and prevents negative available inventory", () => {
    expect(calculateInventoryBalance(8, 2, -3)).toEqual({
      quantityOnHandAfter: 5,
      availableAfter: 3,
    });
    expect(calculateInventoryBalance(3, 2, -2)).toBeNull();
    expect(calculateInventoryBalance(1, 0, -2)).toBeNull();
  });

  it("derives operational availability levels", () => {
    expect(getInventoryLevel(null, null, null)).toBe("uninitialized");
    expect(getInventoryLevel(2, 2, 1)).toBe("out_of_stock");
    expect(getInventoryLevel(3, 1, 2)).toBe("low_stock");
    expect(getInventoryLevel(8, 1, 2)).toBe("in_stock");
  });

  it("orders and transforms history without losing audit fields", () => {
    const history = transformInventoryHistory([
      {
        id: "a",
        movement_type: "receipt",
        quantity_delta: 3,
        quantity_on_hand_after: 3,
        quantity_reserved_after: 0,
        reason: "Recepción inicial",
        reference_type: null,
        reference_id: null,
        actor_id: "actor",
        created_at: "2026-07-30T10:00:00Z",
      },
      {
        id: "b",
        movement_type: "adjustment",
        quantity_delta: -1,
        quantity_on_hand_after: 2,
        quantity_reserved_after: 0,
        reason: "Conteo físico",
        reference_type: "conteo",
        reference_id: "10000000-0000-4000-8000-000000000001",
        actor_id: null,
        created_at: "2026-07-31T10:00:00Z",
      },
    ]);

    expect(history.map((movement) => movement.id)).toEqual(["b", "a"]);
    expect(history[0]?.reference).toContain("conteo");
  });
});

describe("inventory mutation target resolution", () => {
  it("identifies one or several active operational variants", () => {
    const variants = [
      manageableProduct.variants[0]!,
      {
        id: "51000000-0000-4000-8000-000000000002",
        active: true,
        archivedAt: null,
      },
      {
        id: "51000000-0000-4000-8000-000000000003",
        active: false,
        archivedAt: null,
      },
    ];

    expect(variants.filter(isOperationalInventoryVariant)).toHaveLength(2);
    expect(
      manageableProduct.variants.filter(isOperationalInventoryVariant),
    ).toHaveLength(1);
  });

  it("accepts the sole operational variant belonging to the product", () => {
    expect(
      resolveInventoryMutationTarget(
        manageableProduct.id,
        manageableProduct.variants[0]!.id,
        manageableProduct,
      ),
    ).toEqual({
      success: true,
      variantId: manageableProduct.variants[0]!.id,
    });
  });

  it("rejects a variant belonging to another product", () => {
    expect(
      resolveInventoryMutationTarget(
        manageableProduct.id,
        "51000000-0000-4000-8000-000000000099",
        manageableProduct,
      ),
    ).toEqual({ success: false, reason: "variant_mismatch" });
  });

  it("rejects an unavailable variant", () => {
    expect(
      resolveInventoryMutationTarget(
        manageableProduct.id,
        "51000000-0000-4000-8000-000000000002",
        manageableProduct,
      ),
    ).toEqual({ success: false, reason: "variant_mismatch" });
  });

  it("accepts either operational variant of a multi-variant product", () => {
    const secondVariant = {
      id: "51000000-0000-4000-8000-000000000002",
      active: true,
      archivedAt: null,
    };
    const multiVariantProduct = {
      ...manageableProduct,
      variants: [...manageableProduct.variants, secondVariant],
    };
    expect(
      resolveInventoryMutationTarget(
        manageableProduct.id,
        manageableProduct.variants[0]!.id,
        multiVariantProduct,
      ),
    ).toEqual({
      success: true,
      variantId: manageableProduct.variants[0]!.id,
    });
    expect(
      resolveInventoryMutationTarget(
        manageableProduct.id,
        secondVariant.id,
        multiVariantProduct,
      ),
    ).toEqual({ success: true, variantId: secondVariant.id });
  });

  it("rejects inactive and archived variants", () => {
    for (const variant of [
      { ...manageableProduct.variants[0]!, active: false },
      {
        ...manageableProduct.variants[0]!,
        archivedAt: "2026-08-01T00:00:00Z",
      },
    ]) {
      expect(
        resolveInventoryMutationTarget(manageableProduct.id, variant.id, {
          ...manageableProduct,
          variants: [variant],
        }),
      ).toEqual({ success: false, reason: "variant_mismatch" });
    }
  });

  it("rejects archived or unavailable products", () => {
    expect(
      resolveInventoryMutationTarget(
        manageableProduct.id,
        manageableProduct.variants[0]!.id,
        { ...manageableProduct, status: "archived" },
      ),
    ).toEqual({ success: false, reason: "product_not_manageable" });

    expect(
      resolveInventoryMutationTarget(
        manageableProduct.id,
        manageableProduct.variants[0]!.id,
        null,
      ),
    ).toEqual({ success: false, reason: "product_unavailable" });
  });
});

describe("inventory search", () => {
  it("preserves variant SKUs and normalizes unsafe input", () => {
    expect(normalizeInventorySearchTerm(" PG-DEMO-BOLSA-001-GRIS ")).toBe(
      "PG-DEMO-BOLSA-001-GRIS",
    );
    expect(normalizeInventorySearchTerm("  Gris demo,()  ")).toBe("Gris demo");
    expect(normalizeInventorySearchTerm("***")).toBeNull();
  });
});
