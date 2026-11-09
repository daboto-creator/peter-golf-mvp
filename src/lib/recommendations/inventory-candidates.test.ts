import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocked = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: mocked.rpc }),
}));
vi.mock("@/env/server", () => ({ serverEnv: { MARKETPLACE_ENABLED: true } }));

import { loadInventoryUnits } from "./inventory-candidates";

const firstPartyRow = (overrides: Record<string, unknown> = {}) => ({
  product_id: "fp-product",
  slug: "sellable-driver",
  name: "Sellable Driver",
  brand_name: "Brand",
  model_name: "Driver X",
  category_name: "Drivers",
  product_family: "club",
  club_type: "driver",
  set_type: null,
  condition: "new",
  price: 10000,
  currency: "MXN",
  available_quantity: 2,
  technical_specs: { handedness: "right", loftDegrees: 10.5 },
  ...overrides,
});

const marketplaceRow = (available_quantity: number) => ({
  listing_id: `mp-${available_quantity}`,
  slug: `marketplace-${available_quantity}`,
  club_type: "driver",
  set_type: null,
  category_name: "Drivers",
  brand_name: "Partner Brand",
  model_name: "Marketplace Driver",
  condition: "new",
  public_price: 12000,
  available_quantity,
  specifications: {},
});

describe("public recommendation inventory loading", () => {
  beforeEach(() => mocked.rpc.mockReset());

  it("loads public First Party stock for an anonymous server request and keeps marketplace blockers", async () => {
    mocked.rpc.mockImplementation(async (name: string) => {
      if (name === "get_public_first_party_sellable_inventory") {
        return { data: [firstPartyRow()], error: null };
      }
      if (name === "get_public_marketplace_catalog") {
        return { data: [marketplaceRow(1), marketplaceRow(0)], error: null };
      }
      return { data: null, error: new Error("unexpected RPC") };
    });

    const result = await loadInventoryUnits();
    expect(result.error).toBeNull();
    if (result.error) return;
    expect(result.data.map((unit) => unit.productId)).toEqual([
      "fp-product",
      "mp-1",
    ]);
    expect(result.data[0]).toMatchObject({
      source: "FIRST_PARTY",
      stock: 2,
      priceMxnMinor: 10000,
      productHref: "/productos/sellable-driver",
    });
    expect(mocked.rpc).toHaveBeenCalledWith(
      "get_public_first_party_sellable_inventory",
    );
    expect(mocked.rpc).not.toHaveBeenCalledWith(
      "get_best_round_first_party_inventory",
    );
  });

  it.each([
    ["fully reserved", 0],
    ["zero stock", 0],
  ])("never ranks a First Party row with %s", async (_label, available) => {
    mocked.rpc.mockImplementation(async (name: string) =>
      name === "get_public_first_party_sellable_inventory"
        ? {
            data: [firstPartyRow({ available_quantity: available })],
            error: null,
          }
        : { data: [], error: null },
    );

    const result = await loadInventoryUnits();
    expect(result).toEqual({ data: [], error: null });
  });

  it("does not recommend a row with invalid price", async () => {
    mocked.rpc.mockImplementation(async (name: string) =>
      name === "get_public_first_party_sellable_inventory"
        ? { data: [firstPartyRow({ price: null })], error: null }
        : { data: [], error: null },
    );

    const result = await loadInventoryUnits();
    expect(result).toEqual({ data: [], error: null });
  });
});
