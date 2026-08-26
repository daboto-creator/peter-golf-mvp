import { describe, expect, it } from "vitest";

import {
  BUYER_CLAIM_REASONS,
  acceptanceDeadline,
  canAutoAccept,
  claimReasonLabel,
  financialEffectForDecision,
  isBuyerClaimReason,
} from "@/lib/marketplace/claim-rules";

describe("Marketplace delivery and claim rules", () => {
  it("uses an exact UTC-safe 48 hour default acceptance window", () => {
    const delivered = new Date("2026-08-25T18:30:00.000Z");
    expect(acceptanceDeadline(delivered).toISOString()).toBe(
      "2026-08-27T18:30:00.000Z",
    );
  });

  it("auto-accepts only an expired pending delivery without claims or holds", () => {
    const baseline = {
      status: "PENDING",
      deadline: new Date("2026-08-27T18:30:00.000Z"),
      now: new Date("2026-08-27T18:30:00.000Z"),
      hasOpenClaim: false,
      hasRelevantHold: false,
    };
    expect(canAutoAccept(baseline)).toBe(true);
    expect(canAutoAccept({ ...baseline, hasOpenClaim: true })).toBe(false);
    expect(canAutoAccept({ ...baseline, hasRelevantHold: true })).toBe(false);
    expect(
      canAutoAccept({
        ...baseline,
        now: new Date("2026-08-27T18:29:59.999Z"),
      }),
    ).toBe(false);
  });

  it("allows only attributable Marketplace problem reasons for buyers", () => {
    expect(BUYER_CLAIM_REASONS).toHaveLength(6);
    expect(isBuyerClaimReason("WRONG_ITEM")).toBe(true);
    expect(isBuyerClaimReason("OTHER_MANUAL_REVIEW")).toBe(false);
    expect(isBuyerClaimReason("CHANGED_MIND")).toBe(false);
    expect(claimReasonLabel("COUNTERFEIT_SUSPECTED")).toContain("autenticidad");
  });

  it("maps decisions to PR7 compensating financial effects", () => {
    expect(financialEffectForDecision("APPROVED")).toBe("FULL_REVERSAL");
    expect(financialEffectForDecision("PARTIALLY_APPROVED")).toBe(
      "PARTIAL_REVERSAL",
    );
    expect(financialEffectForDecision("REJECTED")).toBe("NONE");
  });
});
