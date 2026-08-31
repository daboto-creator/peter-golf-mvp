import { describe, expect, it } from "vitest";

import {
  fulfillmentGroupKey,
  isCheckoutOfferReady,
  partnerFulfillmentTransition,
} from "@/lib/marketplace/fulfillment-rules";

describe("Marketplace checkout and fulfillment rules", () => {
  it("keeps Partner transitions explicit", () => {
    expect(
      partnerFulfillmentTransition(
        "PENDING_CONFIRMATION",
        "CONFIRM_AVAILABILITY",
      ),
    ).toBe("CONFIRMED");
    expect(partnerFulfillmentTransition("CONFIRMED", "START_PREPARING")).toBe(
      "PREPARING",
    );
    expect(partnerFulfillmentTransition("PREPARING", "READY_FOR_CARRIER")).toBe(
      "READY_FOR_CARRIER",
    );
    expect(
      partnerFulfillmentTransition("READY_FOR_CARRIER", "CONFIRM_SHIPMENT"),
    ).toBe("SHIPPED");
    expect(
      partnerFulfillmentTransition("PENDING_CONFIRMATION", "SHIPPED"),
    ).toBeNull();
  });

  it("groups one Best Round fulfillment and one per Partner/mode", () => {
    expect(fulfillmentGroupKey({ source: "BEST_ROUND" })).toBe("BEST_ROUND");
    expect(
      fulfillmentGroupKey({
        source: "PARTNER",
        partnerId: "a",
        mode: "PARTNER_FULFILLED",
      }),
    ).toBe("PARTNER:a:PARTNER_FULFILLED");
    expect(
      fulfillmentGroupKey({
        source: "PARTNER",
        partnerId: "b",
        mode: "PARTNER_FULFILLED",
      }),
    ).not.toBe(
      fulfillmentGroupKey({
        source: "PARTNER",
        partnerId: "a",
        mode: "PARTNER_FULFILLED",
      }),
    );
  });

  it("rejects stale, risky, unverified and out-of-stock offers", () => {
    const ready = {
      listingApproved: true,
      quoteApproved: true,
      quoteCurrent: true,
      quoteFresh: true,
      inventoryAvailable: 1,
      quantity: 1,
      partnerVerified: true,
      criticalRisk: false,
    };
    expect(isCheckoutOfferReady(ready)).toBe(true);
    expect(isCheckoutOfferReady({ ...ready, quoteFresh: false })).toBe(false);
    expect(isCheckoutOfferReady({ ...ready, criticalRisk: true })).toBe(false);
    expect(isCheckoutOfferReady({ ...ready, inventoryAvailable: 0 })).toBe(
      false,
    );
  });
});
