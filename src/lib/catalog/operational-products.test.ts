import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { listActiveGolfCatalogReferences } from "./operational-products";

function queryResult(data: unknown, error: null = null) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.order = chain;
  builder.eq = chain;
  builder.then = (resolve: (value: unknown) => unknown) => resolve({ data, error });
  return builder;
}

describe("pure golf catalog reference loader", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
  });

  it("loads references without querying pricing or payment configuration", async () => {
    const calls: string[] = [];
    mocks.createClient.mockResolvedValue({
      from: (table: string) => {
        calls.push(table);
        if (table === "brands") return queryResult([{ id: "tm", name: "TaylorMade", slug: "taylormade", status: "active" }]);
        if (table === "categories") return queryResult([{ id: "putter", parent_id: null, sort_order: 1, slug: "putter", name: "Putter", status: "active", profile: { family: "club", club_type: "putter", bag_type: null, set_type: null } }]);
        return queryResult([{ id: "spider-tour", brand_id: "tm", category_id: "putter", model_name: "Spider Tour", normalized_model_name: "spider-tour", status: "active" }]);
      },
    });

    const result = await listActiveGolfCatalogReferences();

    expect(result.error).toBeNull();
    expect(result.data?.models.map((model) => model.id)).toEqual(["spider-tour"]);
    expect(calls).toEqual(["brands", "categories", "catalog_product_models"]);
    expect(calls).not.toContain("pricing_rules");
    expect(calls).not.toContain("payment_fee_configs");
  });
});
