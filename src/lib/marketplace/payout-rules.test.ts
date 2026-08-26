import { describe, expect, it } from "vitest";

import {
  calculatePayoutTotal,
  canEditPayoutItems,
  canRecordManualTransfer,
  isPayablePayoutEligible,
  isPayoutProviderEnabled,
  isSettlementAmountExact,
  payoutStatusLabel,
} from "./payout-rules";

describe("Marketplace payout rules", () => {
  it("conserves exact integer cents", () => {
    expect(calculatePayoutTotal([100_000, 250_050, 3_999])).toBe(354_049);
    expect(() => calculatePayoutTotal([1.5])).toThrow(/integer cents/);
  });

  it("accepts only an unheld AVAILABLE MXN position", () => {
    const eligible = {
      status: "AVAILABLE",
      activeHolds: 0,
      partnerStatus: "VERIFIED",
      currency: "MXN",
      remainingCents: 10_000,
      activePayout: false,
    };
    expect(isPayablePayoutEligible(eligible)).toBe(true);
    for (const status of ["PENDING", "ON_HOLD", "REVERSED", "PAID"]) {
      expect(isPayablePayoutEligible({ ...eligible, status })).toBe(false);
    }
    expect(isPayablePayoutEligible({ ...eligible, activeHolds: 1 })).toBe(
      false,
    );
    expect(isPayablePayoutEligible({ ...eligible, activePayout: true })).toBe(
      false,
    );
  });

  it("enables only the manual administrative provider", () => {
    expect(isPayoutProviderEnabled("MANUAL_BANK_TRANSFER")).toBe(true);
    expect(isPayoutProviderEnabled("STRIPE_CONNECT")).toBe(false);
    expect(isPayoutProviderEnabled("OTHER_PROVIDER")).toBe(false);
  });

  it("locks item editing after draft and validates settlement", () => {
    expect(canEditPayoutItems("DRAFT")).toBe(true);
    expect(canEditPayoutItems("READY")).toBe(false);
    expect(
      canRecordManualTransfer({
        status: "READY",
        provider: "MANUAL_BANK_TRANSFER",
        totalCents: 354_049,
        activeHolds: 0,
      }),
    ).toBe(true);
    expect(isSettlementAmountExact(354_049, 354_049)).toBe(true);
    expect(isSettlementAmountExact(354_049, 354_048)).toBe(false);
  });

  it("uses Partner-safe display labels", () => {
    expect(payoutStatusLabel("READY")).toBe("Programado");
    expect(payoutStatusLabel("PAID")).toBe("Pagado");
    expect(payoutStatusLabel("RECONCILIATION_REQUIRED")).toBe(
      "Requiere revisión",
    );
  });
});
