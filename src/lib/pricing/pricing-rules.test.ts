import { describe, expect, it } from "vitest";

import {
  PRICING_TARGET_RETURN_BPS,
  resolvePricingRule,
} from "@/lib/pricing/pricing-rules";

describe("pricing rule resolution", () => {
  it("gives Trade-in priority over taxonomy", () => {
    expect(
      resolvePricingRule({
        acquisitionChannel: "trade_in",
        condition: "new",
        productFamily: "club",
        clubType: "driver",
      }),
    ).toBe("TRADE_IN");
  });

  it.each([
    ["iron", "IRON_NEW"],
    ["wedge", "WEDGE_NEW"],
    ["putter", "PUTTER_NEW"],
  ] as const)("maps a new %s to %s", (clubType, expected) => {
    expect(
      resolvePricingRule({
        acquisitionChannel: "purchase",
        condition: "new",
        productFamily: "club",
        clubType,
      }),
    ).toBe(expected);
  });

  it("maps used Complete, Starter and Junior Sets without OTHER", () => {
    for (const setType of [
      "complete_set",
      "starter_set",
      "junior_set",
    ] as const) {
      expect(
        resolvePricingRule({
          acquisitionChannel: "purchase",
          condition: "used",
          productFamily: "set",
          setType,
        }),
      ).toBe("COMPLETE_SET_USED");
    }
  });

  it("keeps used Iron Sets in their dedicated rule", () => {
    expect(
      resolvePricingRule({
        acquisitionChannel: "purchase",
        condition: "used",
        productFamily: "set",
        setType: "iron_set",
      }),
    ).toBe("IRON_SET_USED");
  });

  it("prefers the category profile mapping and has a safe default", () => {
    expect(
      resolvePricingRule({
        acquisitionChannel: "purchase",
        condition: "new",
        productFamily: null,
        mappedNewRule: "BALLS",
      }),
    ).toBe("BALLS");
    expect(
      resolvePricingRule({
        acquisitionChannel: "purchase",
        condition: "new",
        productFamily: null,
        categorySlug: "sin-configurar",
      }),
    ).toBe("OTHER");
  });

  it("uses a structured subtype before a generic root mapping", () => {
    expect(
      resolvePricingRule({
        acquisitionChannel: "purchase",
        condition: "new",
        productFamily: "club",
        clubType: "iron",
        mappedNewRule: "OTHER",
      }),
    ).toBe("IRON_NEW");
  });

  it("centralizes every approved target in basis points", () => {
    expect(PRICING_TARGET_RETURN_BPS).toMatchObject({
      IRON_NEW: 3_000,
      COMPLETE_SET_USED: 4_000,
      TRADE_IN: 5_000,
      SMALL_ACCESSORY: 6_000,
      OTHER: 3_500,
    });
  });
});
