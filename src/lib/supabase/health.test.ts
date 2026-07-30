import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { checkSupabaseHealth } from "@/lib/supabase/health";
import type { Database } from "@/types/database.types";

function createHealthClient(
  result: { error: unknown } | Promise<never>,
): SupabaseClient<Database> {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve(result)),
      })),
    })),
  } as unknown as SupabaseClient<Database>;
}

describe("checkSupabaseHealth", () => {
  it("reports an available read connection", async () => {
    const client = createHealthClient({ error: null });

    await expect(checkSupabaseHealth(client)).resolves.toBe("available");
  });

  it("does not expose a Supabase query error", async () => {
    const client = createHealthClient({ error: new Error("internal detail") });

    await expect(checkSupabaseHealth(client)).resolves.toBe("unavailable");
  });

  it("reports rejected requests as unavailable", async () => {
    const client = createHealthClient(
      Promise.reject(new Error("network detail")),
    );

    await expect(checkSupabaseHealth(client)).resolves.toBe("unavailable");
  });
});
