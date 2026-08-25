import { describe, expect, it } from "vitest";

import {
  canPlacePayableHold,
  canReleasePayable,
  canReversePayable,
  partnerPayableLabel,
  reconstructPartnerBalance,
} from "@/lib/marketplace/partner-finance-rules";

describe("Marketplace Partner finance rules", () => {
  it("reconstructs every balance bucket from signed immutable deltas", () => {
    expect(
      reconstructPartnerBalance([
        {
          pendingCents: 10_000,
          onHoldCents: 0,
          availableCents: 0,
          paidCents: 0,
          reversedCents: 0,
        },
        {
          pendingCents: -10_000,
          onHoldCents: 10_000,
          availableCents: 0,
          paidCents: 0,
          reversedCents: 0,
        },
        {
          pendingCents: 0,
          onHoldCents: -2_500,
          availableCents: 0,
          paidCents: 0,
          reversedCents: 2_500,
        },
      ]),
    ).toEqual({
      pendingCents: 0,
      onHoldCents: 7_500,
      availableCents: 0,
      paidCents: 0,
      reversedCents: 2_500,
      netPositionCents: 7_500,
    });
  });

  it("keeps release stricter than hold and reversal", () => {
    expect(canPlacePayableHold("AVAILABLE")).toBe(true);
    expect(canReversePayable("ON_HOLD")).toBe(true);
    expect(
      canReleasePayable({
        status: "PENDING",
        activeHolds: 0,
        fulfillmentStatus: "ACCEPTANCE_PENDING",
      }),
    ).toBe(true);
    expect(
      canReleasePayable({
        status: "PENDING",
        activeHolds: 1,
        fulfillmentStatus: "COMPLETED",
      }),
    ).toBe(false);
    expect(
      canReleasePayable({
        status: "PENDING",
        activeHolds: 0,
        fulfillmentStatus: "SHIPPED",
      }),
    ).toBe(false);
  });

  it("uses Partner-facing, non-banking language", () => {
    expect(partnerPayableLabel("PENDING")).toBe("Saldo pendiente");
    expect(partnerPayableLabel("ON_HOLD")).toBe("En revisión");
    expect(partnerPayableLabel("AVAILABLE")).toBe(
      "Disponible para próximo pago",
    );
  });
});
