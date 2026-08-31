export type FulfillmentStatus =
  | "PENDING_CONFIRMATION"
  | "CONFIRMED"
  | "PREPARING"
  | "READY_FOR_CARRIER"
  | "SHIPPED"
  | "DELIVERED"
  | "ACCEPTANCE_PENDING"
  | "COMPLETED"
  | "CANCELLED"
  | "ON_HOLD";

const partnerTransitions: Record<string, FulfillmentStatus> = {
  "PENDING_CONFIRMATION:CONFIRM_AVAILABILITY": "CONFIRMED",
  "PENDING_CONFIRMATION:UNAVAILABLE": "CANCELLED",
  "CONFIRMED:UNAVAILABLE": "CANCELLED",
  "CONFIRMED:START_PREPARING": "PREPARING",
  "PREPARING:READY_FOR_CARRIER": "READY_FOR_CARRIER",
  "READY_FOR_CARRIER:CONFIRM_SHIPMENT": "SHIPPED",
};

export function partnerFulfillmentTransition(
  status: FulfillmentStatus,
  action: string,
): FulfillmentStatus | null {
  return partnerTransitions[`${status}:${action}`] ?? null;
}

export function fulfillmentGroupKey(input: {
  source: "BEST_ROUND" | "PARTNER";
  partnerId?: string | null;
  mode?: "PARTNER_FULFILLED" | "BEST_ROUND_FULFILLED" | null;
}) {
  return input.source === "BEST_ROUND"
    ? "BEST_ROUND"
    : `PARTNER:${input.partnerId ?? "missing"}:${input.mode ?? "missing"}`;
}

export function isCheckoutOfferReady(input: {
  listingApproved: boolean;
  quoteApproved: boolean;
  quoteCurrent: boolean;
  quoteFresh: boolean;
  inventoryAvailable: number;
  quantity: number;
  partnerVerified: boolean;
  criticalRisk: boolean;
}) {
  return (
    input.listingApproved &&
    input.quoteApproved &&
    input.quoteCurrent &&
    input.quoteFresh &&
    input.partnerVerified &&
    !input.criticalRisk &&
    input.quantity > 0 &&
    input.inventoryAvailable >= input.quantity
  );
}
