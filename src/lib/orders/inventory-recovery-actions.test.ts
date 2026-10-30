import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOrdersManager: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/order-authorization", () => ({
  requireOrdersManager: mocks.requireOrdersManager,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: mocks.rpc })),
}));

import { resolveInventoryRecoveryAction } from "@/lib/orders/inventory-recovery-actions";

const valid = {
  orderId: "77000000-0000-4000-8000-000000000001",
  caseId: "88000000-0000-4000-8000-000000000001",
  caseVersion: "1",
  idempotencyKey: "99000000-0000-4000-8000-000000000001",
  disposition: "RESTOCKABLE",
  reason: "Physical return inspected and accepted",
};

function form(values: Record<string, string> = valid) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("resolveInventoryRecoveryAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOrdersManager.mockResolvedValue(undefined);
    mocks.rpc.mockResolvedValue({ error: null });
  });

  test("requires order management and calls the recovery RPC", async () => {
    const result = await resolveInventoryRecoveryAction(
      { status: "idle", message: "" },
      form(),
    );

    expect(mocks.requireOrdersManager).toHaveBeenCalledWith(
      `/operacion/pedidos/${valid.orderId}`,
    );
    expect(mocks.rpc).toHaveBeenCalledWith(
      "resolve_first_party_inventory_recovery",
      {
        requested_case_id: valid.caseId,
        expected_version: 1,
        requested_disposition: "RESTOCKABLE",
        requested_reason: valid.reason,
        requested_idempotency_key: valid.idempotencyKey,
      },
    );
    expect(result.status).toBe("success");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      `/operacion/pedidos/${valid.orderId}`,
    );
  });

  test("rejects invalid reason and does not call the RPC", async () => {
    const result = await resolveInventoryRecoveryAction(
      { status: "idle", message: "" },
      form({ ...valid, reason: "  " }),
    );

    expect(result.status).toBe("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  test("maps stale case conflicts to a safe refresh message", async () => {
    mocks.rpc.mockResolvedValue({ error: { code: "40001" } });
    const result = await resolveInventoryRecoveryAction(
      { status: "idle", message: "" },
      form(),
    );

    expect(result).toEqual({
      status: "error",
      message: "El caso cambió. Recarga la página antes de continuar.",
    });
  });
});
