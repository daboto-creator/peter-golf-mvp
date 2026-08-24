import { describe, expect, it } from "vitest";

import { roundUpToCommercialPrice } from "@/lib/pricing/commercial-rounding";
import { calculatePricing } from "@/lib/pricing/pricing-engine";
import {
  PETER_GOLF_PAYMENT_FEE,
  PRICING_TARGET_RETURN_BPS,
} from "@/lib/pricing/pricing-rules";
import type {
  MarketReference,
  PricingEngineInput,
  PricingRuleCode,
} from "@/lib/pricing/pricing-types";

const unavailableMarket: MarketReference = {
  medianPriceMxn: null,
  averagePriceMxn: null,
  lowPriceMxn: null,
  highPriceMxn: null,
  sampleSize: 0,
  confidence: "unavailable",
  source: null,
  sourceUrl: null,
  checkedAt: null,
};

function input(
  overrides: Partial<PricingEngineInput> = {},
): PricingEngineInput {
  const pricingRuleCode = overrides.pricingRuleCode ?? "DRIVER_NEW";
  return {
    costs: {
      acquisitionCost: 800_000,
      conditioningCost: 20_000,
      packagingCost: 10_000,
      shippingSubsidy: 15_000,
    },
    pricingRuleCode,
    targetReturnBps: PRICING_TARGET_RETURN_BPS[pricingRuleCode],
    paymentFee: PETER_GOLF_PAYMENT_FEE,
    market: unavailableMarket,
    ...overrides,
  };
}

function market(medianPriceMxn: number): MarketReference {
  return {
    medianPriceMxn,
    averagePriceMxn: medianPriceMxn,
    lowPriceMxn: Math.floor(medianPriceMxn * 0.95),
    highPriceMxn: Math.floor(medianPriceMxn * 1.05),
    sampleSize: 5,
    confidence: "medium",
    source: "Referencia manual",
    sourceUrl: null,
    checkedAt: "2026-08-18T12:00:00.000Z",
  };
}

describe("Best Round pricing engine", () => {
  it("calculates the exact fee-backed financial floor", () => {
    const result = calculatePricing(input());

    expect(result.totalDirectCost).toBe(845_000);
    expect(result.desiredContribution).toBe(253_500);
    expect(result.financialPrice).toBe(1_139_835);
    expect(result.status).toBe("NO_MARKET_REFERENCE");
    expect(result.automaticSuggestedPrice).toBe(1_139_900);
    expect(result.estimatedPaymentFee).toBe(41_337);
    expect(result.expectedContribution).toBe(253_563);
    expect(result.returnOnCostBps).toBe(3_000);
    expect(result.marginOnSaleBps).toBe(2_224);
    expect(result.health).toBe("GREEN");
  });

  it("keeps a financial price that is within the ±10% market band", () => {
    const result = calculatePricing(input({ market: market(1_150_000) }));

    expect(result.status).toBe("AUTO_COMPETITIVE");
    expect(result.marketLowerBound).toBe(1_035_000);
    expect(result.marketUpperBound).toBe(1_265_000);
    expect(result.automaticSuggestedPrice).toBe(1_139_900);
  });

  it("does not lower a financial floor above market", () => {
    const result = calculatePricing(input({ market: market(900_000) }));

    expect(result.status).toBe("ABOVE_MARKET_WARNING");
    expect(result.automaticSuggestedPrice).toBeGreaterThanOrEqual(
      result.financialPrice,
    );
    expect(result.warnings).toContain(
      "El precio financiero mínimo está por encima del rango competitivo.",
    );
  });

  it("raises an inexpensive financial price toward the market band", () => {
    const result = calculatePricing(input({ market: market(1_500_000) }));

    expect(result.status).toBe("AUTO_MARKET_ADJUSTED_UP");
    expect(result.minimumCompetitivePrice).toBe(1_350_000);
    expect(result.automaticSuggestedPrice).toBe(1_359_900);
    expect(result.automaticSuggestedPrice).toBeLessThanOrEqual(1_650_000);
  });

  it("shows low-confidence market without allowing it to force an adjustment", () => {
    const result = calculatePricing(
      input({
        market: { ...market(1_500_000), confidence: "low", sampleSize: 1 },
      }),
    );
    expect(result.status).toBe("NO_MARKET_REFERENCE");
    expect(result.marketLowerBound).toBeNull();
    expect(result.automaticSuggestedPrice).toBe(1_139_900);
    expect(result.marketDeltaBps).not.toBeNull();
  });

  it("supports the approved Trade-in and Small Accessory targets", () => {
    for (const code of ["TRADE_IN", "SMALL_ACCESSORY"] as const) {
      const result = calculatePricing(
        input({
          pricingRuleCode: code,
          targetReturnBps: PRICING_TARGET_RETURN_BPS[code],
        }),
      );
      expect(result.returnOnCostBps).toBeGreaterThanOrEqual(
        PRICING_TARGET_RETURN_BPS[code],
      );
    }
  });

  it("records an operator override above the financial floor", () => {
    const result = calculatePricing(
      input({
        finalSalePrice: 1_200_000,
        manualPriceReason: "Precio acordado",
      }),
    );

    expect(result.override).toBe(true);
    expect(result.finalSalePrice).toBe(1_200_000);
    expect(result.manualPriceReason).toBe("Precio acordado");
  });

  it("requires admin authority and a reason below the financial floor", () => {
    expect(() =>
      calculatePricing(input({ finalSalePrice: 1_100_000 })),
    ).toThrow("Sólo un administrador");
    expect(() =>
      calculatePricing(
        input({
          finalSalePrice: 1_100_000,
          canPriceBelowFinancial: true,
        }),
      ),
    ).toThrow("Debes indicar el motivo");

    const result = calculatePricing(
      input({
        finalSalePrice: 1_100_000,
        canPriceBelowFinancial: true,
        manualPriceReason: "Decisión comercial autorizada",
      }),
    );
    expect(result.override).toBe(true);
    expect(result.health).toBe("YELLOW");
  });

  it("blocks every price below total direct cost", () => {
    expect(() =>
      calculatePricing(
        input({
          finalSalePrice: 844_999,
          canPriceBelowFinancial: true,
          manualPriceReason: "No debe bastar",
        }),
      ),
    ).toThrow("por debajo del costo directo");
  });

  it("rejects zero acquisition cost for automatic pricing", () => {
    expect(() =>
      calculatePricing(
        input({ costs: { ...input().costs, acquisitionCost: 0 } }),
      ),
    ).toThrow("mayor que cero");
  });

  it("rejects invalid market references", () => {
    expect(() =>
      calculatePricing(
        input({
          market: {
            ...market(1_000_000),
            lowPriceMxn: 1_100_000,
          },
        }),
      ),
    ).toThrow("rango de mercado");
  });

  it("recalculates metrics when costs change", () => {
    const original = calculatePricing(input());
    const changed = calculatePricing(
      input({
        costs: { ...input().costs, acquisitionCost: 900_000 },
      }),
    );
    expect(changed.financialPrice).toBeGreaterThan(original.financialPrice);
    expect(changed.automaticSuggestedPrice).toBeGreaterThan(
      original.automaticSuggestedPrice,
    );
  });

  it("never rounds below the required financial or competitive minimum", () => {
    for (const minimum of [756_342, 1_187_342, 1_344_400, 1_399_999]) {
      expect(roundUpToCommercialPrice(minimum)).toBeGreaterThanOrEqual(minimum);
    }
    expect(roundUpToCommercialPrice(756_342)).toBe(759_900);
    expect(roundUpToCommercialPrice(1_187_342)).toBe(1_189_000);
    expect(roundUpToCommercialPrice(1_344_400)).toBe(1_349_000);
  });

  it("uses the exact minimum if the next ending would exceed market", () => {
    expect(roundUpToCommercialPrice(1_265_000, 1_265_000)).toBe(1_265_000);
  });

  it.each([
    "IRON_NEW",
    "COMPLETE_SET_USED",
    "IRON_SET_USED",
    "PUTTER_USED",
  ] satisfies PricingRuleCode[])("supports the definitive %s rule", (code) => {
    const result = calculatePricing(
      input({
        pricingRuleCode: code,
        targetReturnBps: PRICING_TARGET_RETURN_BPS[code],
      }),
    );
    expect(result.returnOnCostBps).toBeGreaterThanOrEqual(
      PRICING_TARGET_RETURN_BPS[code],
    );
  });
});
