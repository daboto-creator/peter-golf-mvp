import {
  assertBasisPoints,
  assertMinorUnits,
  ceilDivide,
  multiplyBpsCeil,
  ratioToBps,
  toSafeMinorUnits,
} from "@/lib/pricing/money";
import { roundUpToCommercialPrice } from "@/lib/pricing/commercial-rounding";
import { PRICING_HEALTH_TOLERANCE_BPS } from "@/lib/pricing/pricing-rules";
import type {
  MarketReference,
  PricingEngineInput,
  PricingEngineResult,
  PricingHealth,
  PricingStatus,
} from "@/lib/pricing/pricing-types";

function validateMarket(market: MarketReference): void {
  for (const [label, value] of [
    ["Referencia de mercado", market.medianPriceMxn],
    ["Mínimo de mercado", market.lowPriceMxn],
    ["Máximo de mercado", market.highPriceMxn],
  ] as const) {
    if (value !== null) assertMinorUnits(value, label);
  }
  if (!Number.isSafeInteger(market.sampleSize) || market.sampleSize < 0) {
    throw new Error("La muestra de mercado debe ser un entero no negativo.");
  }
  if (market.medianPriceMxn === null) {
    if (market.confidence !== "unavailable") {
      throw new Error("Mercado sin mediana debe marcarse como no disponible.");
    }
    return;
  }
  if (market.medianPriceMxn <= 0 || market.confidence === "unavailable") {
    throw new Error("La referencia de mercado no es válida.");
  }
  if (
    (market.lowPriceMxn !== null &&
      market.lowPriceMxn > market.medianPriceMxn) ||
    (market.highPriceMxn !== null &&
      market.highPriceMxn < market.medianPriceMxn) ||
    (market.lowPriceMxn !== null &&
      market.highPriceMxn !== null &&
      market.lowPriceMxn > market.highPriceMxn)
  ) {
    throw new Error("El rango de mercado no contiene la mediana.");
  }
}

function calculateHealth(
  returnOnCostBps: number,
  targetReturnBps: number,
): PricingHealth {
  if (returnOnCostBps >= targetReturnBps) return "GREEN";
  if (returnOnCostBps >= targetReturnBps - PRICING_HEALTH_TOLERANCE_BPS) {
    return "YELLOW";
  }
  return "RED";
}

export function calculatePricing(
  input: PricingEngineInput,
): PricingEngineResult {
  Object.entries(input.costs).forEach(([label, value]) =>
    assertMinorUnits(value, label),
  );
  if (input.costs.acquisitionCost <= 0) {
    throw new Error("El costo de adquisición debe ser mayor que cero.");
  }
  assertBasisPoints(input.targetReturnBps, "Target de utilidad");
  assertBasisPoints(input.paymentFee.percentageBps, "Fee porcentual");
  assertMinorUnits(input.paymentFee.fixedFeeMinor, "Fee fijo");
  validateMarket(input.market);

  const totalDirectCost = toSafeMinorUnits(
    Object.values(input.costs).reduce(
      (total, value) => total + BigInt(value),
      BigInt(0),
    ),
    "Costo directo total",
  );
  const desiredContribution = multiplyBpsCeil(
    totalDirectCost,
    input.targetReturnBps,
  );
  const financialPrice = toSafeMinorUnits(
    ceilDivide(
      BigInt(totalDirectCost) * BigInt(10_000 + input.targetReturnBps) +
        BigInt(input.paymentFee.fixedFeeMinor) * BigInt(10_000),
      BigInt(10_000 - input.paymentFee.percentageBps),
    ),
    "Precio financiero",
  );

  let marketLowerBound: number | null = null;
  let marketUpperBound: number | null = null;
  let minimumCompetitivePrice: number | null = null;
  let status: PricingStatus = "NO_MARKET_REFERENCE";
  let automaticSuggestedPrice = roundUpToCommercialPrice(financialPrice);
  const warnings: string[] = [];

  const hasReliableMarket =
    input.market.medianPriceMxn !== null &&
    (input.market.confidence === "high" ||
      input.market.confidence === "medium");

  if (hasReliableMarket && input.market.medianPriceMxn !== null) {
    marketLowerBound = multiplyBpsCeil(input.market.medianPriceMxn, 9_000);
    marketUpperBound = toSafeMinorUnits(
      (BigInt(input.market.medianPriceMxn) * BigInt(11_000)) / BigInt(10_000),
      "Límite superior de mercado",
    );

    if (financialPrice > marketUpperBound) {
      status = "ABOVE_MARKET_WARNING";
      automaticSuggestedPrice = roundUpToCommercialPrice(financialPrice);
      warnings.push(
        "El precio financiero mínimo está por encima del rango competitivo.",
      );
    } else if (financialPrice < marketLowerBound) {
      status = "AUTO_MARKET_ADJUSTED_UP";
      minimumCompetitivePrice = Math.max(financialPrice, marketLowerBound);
      automaticSuggestedPrice = roundUpToCommercialPrice(
        minimumCompetitivePrice,
        marketUpperBound,
      );
    } else {
      status = "AUTO_COMPETITIVE";
      automaticSuggestedPrice = roundUpToCommercialPrice(
        financialPrice,
        marketUpperBound,
      );
    }
  } else {
    warnings.push(
      input.market.confidence === "low"
        ? "La referencia de mercado tiene confianza baja y se muestra sólo como orientación; no ajustó el precio automáticamente."
        : "No fue posible obtener una referencia de mercado suficientemente confiable. El precio fue calculado utilizando costo, procesamiento de pago y utilidad objetivo Peter Golf.",
    );
  }

  const finalSalePrice = input.finalSalePrice ?? automaticSuggestedPrice;
  assertMinorUnits(finalSalePrice, "Precio final");
  if (finalSalePrice < totalDirectCost) {
    throw new Error(
      "El precio final no puede quedar por debajo del costo directo.",
    );
  }
  const override = finalSalePrice !== automaticSuggestedPrice;
  const manualPriceReason = input.manualPriceReason?.trim() || null;
  if (override && finalSalePrice < financialPrice) {
    if (!input.canPriceBelowFinancial) {
      throw new Error(
        "Sólo un administrador puede guardar por debajo del precio financiero.",
      );
    }
    if (!manualPriceReason) {
      throw new Error(
        "Debes indicar el motivo para guardar por debajo del precio financiero.",
      );
    }
    warnings.push("El precio manual está por debajo del target financiero.");
  }

  const estimatedPaymentFee =
    multiplyBpsCeil(finalSalePrice, input.paymentFee.percentageBps) +
    input.paymentFee.fixedFeeMinor;
  const expectedContribution =
    finalSalePrice - totalDirectCost - estimatedPaymentFee;
  const returnOnCostBps = ratioToBps(expectedContribution, totalDirectCost);
  const marginOnSaleBps = ratioToBps(expectedContribution, finalSalePrice);
  const marketDeltaBps =
    input.market.medianPriceMxn === null
      ? null
      : ratioToBps(
          finalSalePrice - input.market.medianPriceMxn,
          input.market.medianPriceMxn,
        );

  return {
    totalDirectCost,
    desiredContribution,
    financialPrice,
    minimumCompetitivePrice,
    marketLowerBound,
    marketUpperBound,
    automaticSuggestedPrice,
    finalSalePrice,
    estimatedPaymentFee,
    expectedContribution,
    returnOnCostBps,
    marginOnSaleBps,
    marketDeltaBps,
    status,
    health: calculateHealth(returnOnCostBps, input.targetReturnBps),
    override,
    manualPriceReason,
    warnings,
  };
}
