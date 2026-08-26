export type MarketplacePayoutStatus =
  | "DRAFT"
  | "READY"
  | "ON_HOLD"
  | "AWAITING_CONFIRMATION"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | "RECONCILIATION_REQUIRED";

export type MarketplacePayoutProvider =
  "MANUAL_BANK_TRANSFER" | "STRIPE_CONNECT" | "OTHER_PROVIDER";

export const ENABLED_PAYOUT_PROVIDERS = ["MANUAL_BANK_TRANSFER"] as const;

export function isPayoutProviderEnabled(provider: MarketplacePayoutProvider) {
  return ENABLED_PAYOUT_PROVIDERS.includes(
    provider as (typeof ENABLED_PAYOUT_PROVIDERS)[number],
  );
}

export function calculatePayoutTotal(amounts: number[]) {
  return amounts.reduce((total, amount) => {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error("Payout amounts must be positive integer cents.");
    }
    const next = total + amount;
    if (!Number.isSafeInteger(next)) throw new Error("Payout total overflow.");
    return next;
  }, 0);
}

export function isPayablePayoutEligible(input: {
  status: string;
  activeHolds: number;
  partnerStatus: string;
  currency: string;
  remainingCents: number;
  activePayout: boolean;
}) {
  return (
    input.status === "AVAILABLE" &&
    input.activeHolds === 0 &&
    input.partnerStatus === "VERIFIED" &&
    input.currency === "MXN" &&
    Number.isSafeInteger(input.remainingCents) &&
    input.remainingCents > 0 &&
    !input.activePayout
  );
}

export function payoutStatusLabel(status: MarketplacePayoutStatus) {
  const labels: Record<MarketplacePayoutStatus, string> = {
    DRAFT: "En preparación",
    READY: "Programado",
    ON_HOLD: "En revisión",
    AWAITING_CONFIRMATION: "En preparación",
    PAID: "Pagado",
    FAILED: "Requiere revisión",
    CANCELLED: "Cancelado",
    RECONCILIATION_REQUIRED: "Requiere revisión",
  };
  return labels[status];
}

export function canEditPayoutItems(status: MarketplacePayoutStatus) {
  return status === "DRAFT";
}

export function canRecordManualTransfer(input: {
  status: MarketplacePayoutStatus;
  provider: MarketplacePayoutProvider;
  totalCents: number;
  activeHolds: number;
}) {
  return (
    input.status === "READY" &&
    input.provider === "MANUAL_BANK_TRANSFER" &&
    Number.isSafeInteger(input.totalCents) &&
    input.totalCents > 0 &&
    input.activeHolds === 0
  );
}

export function isSettlementAmountExact(expected: number, confirmed: number) {
  return (
    Number.isSafeInteger(expected) &&
    Number.isSafeInteger(confirmed) &&
    expected > 0 &&
    expected === confirmed
  );
}
