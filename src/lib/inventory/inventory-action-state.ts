export type InventoryActionResult = {
  status: "idle" | "success" | "error";
  message?: string;
  balance?: { before: number; after: number; availableAfter: number };
  nextIdempotencyKey?: string;
};

export const initialInventoryActionResult: InventoryActionResult = {
  status: "idle",
};
