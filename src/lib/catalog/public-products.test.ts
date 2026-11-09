import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const fixtures = vi.hoisted(() => ({
  rpc: vi.fn(),
  products: [] as unknown[],
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: fixtures.rpc,
    from: () => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        is: () => builder,
        order: () => builder,
        limit: () => builder,
        then: (
          resolve: (value: unknown) => unknown,
          reject: (reason: unknown) => unknown,
        ) =>
          Promise.resolve({ data: fixtures.products, error: null }).then(
            resolve,
            reject,
          ),
      };
      return builder;
    },
  }),
}));
vi.mock("@/env/server", () => ({ serverEnv: { MARKETPLACE_ENABLED: false } }));

import { listPublicProducts } from "./public-products";

function productRow(id: string) {
  return {
    id,
    slug: id,
    name: id,
    condition: "new",
    condition_grade: null,
    condition_score: null,
    fulfillment_type: "in_stock",
    price: 10000,
    compare_at_price: null,
    currency: "MXN",
    price_is_estimate: false,
    lead_time_min_days: null,
    lead_time_max_days: null,
    brand: { id: "brand", name: "Brand" },
    category: { id: "category", name: "Drivers", profile: { family: "club" } },
    images: [],
    club_specs: {
      club_type: "driver",
      handedness: "right",
      shaft_flex: "regular",
      shaft_material: "graphite",
      loft_degrees: 10.5,
    },
    bag_specs: null,
    set_specs: null,
    components: [],
  };
}

describe("public First Party stock projection", () => {
  beforeEach(() => {
    fixtures.products = [productRow("stock-two"), productRow("no-stock")];
    fixtures.rpc.mockReset().mockResolvedValue({
      data: [{ product_id: "stock-two", available_quantity: 2 }],
      error: null,
    });
  });

  it("uses the same projected quantity for public catalog and availability filters", async () => {
    const all = await listPublicProducts();
    expect(all.error).toBeNull();
    if (all.error) return;
    expect(
      all.data.map(({ id, availableQuantity }) => [id, availableQuantity]),
    ).toEqual([
      ["stock-two", 2],
      ["no-stock", 0],
    ]);

    const available = await listPublicProducts({ available: true });
    expect(available.error).toBeNull();
    if (available.error) return;
    expect(available.data.map(({ id }) => id)).toEqual(["stock-two"]);
  });
});
