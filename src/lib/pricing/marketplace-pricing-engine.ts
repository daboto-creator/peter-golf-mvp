import {
  assertBasisPoints,
  assertMinorUnits,
  ceilDivide,
  toSafeMinorUnits,
} from "@/lib/pricing/money";
import type {
  MarketplaceEconomics,
  MarketplaceEconomicsConfig,
  MarketplacePriceResolution,
  MarketplacePricingInputMode,
  MarketplaceViability,
} from "@/lib/pricing/marketplace-pricing-types";

const MAX_MARKETPLACE_PRICE_MINOR = 99_999_999_999_999;
const BPS_DENOMINATOR = BigInt(10_000);
const COMPOUND_BPS_DENOMINATOR = BPS_DENOMINATOR * BPS_DENOMINATOR;

function validateConfig(config: MarketplaceEconomicsConfig): void {
  assertBasisPoints(config.commissionBps, "Comisión Marketplace");
  assertBasisPoints(config.commissionVatBps, "IVA sobre comisión");
  assertBasisPoints(config.paymentProcessingBps, "Procesamiento");
  assertBasisPoints(
    config.partnerProcessingShareBps,
    "Participación Partner en procesamiento",
  );
  assertBasisPoints(config.adminFeeBps, "Fee administrativo");
  assertMinorUnits(config.paymentProcessingFixedMinor, "Fee fijo de pago");
  assertMinorUnits(config.adminFixedFeeMinor, "Fee administrativo fijo");
  if (config.minimumMarketplaceRevenueMinor !== null) {
    assertMinorUnits(
      config.minimumMarketplaceRevenueMinor,
      "Ingreso mínimo Marketplace",
    );
  }

  // The variable Partner deductions must grow by less than one cent for every
  // additional cent of public price. This makes an economically valid config
  // monotonic and is also required by the exact inverse-price contract.
  const variablePartnerDeductionNumerator =
    BigInt(config.commissionBps) * BPS_DENOMINATOR +
    BigInt(config.commissionBps) * BigInt(config.commissionVatBps) +
    BigInt(config.paymentProcessingBps) *
      BigInt(config.partnerProcessingShareBps) +
    BigInt(config.adminFeeBps) * BPS_DENOMINATOR;
  if (variablePartnerDeductionNumerator >= COMPOUND_BPS_DENOMINATOR) {
    throw new Error(
      "La configuración de cargos variables debe ser menor que el precio público.",
    );
  }
}

export function calculateMarketplaceEconomics(
  publicPriceMinor: number,
  config: MarketplaceEconomicsConfig,
): MarketplaceEconomics {
  assertMinorUnits(publicPriceMinor, "Precio público");
  if (publicPriceMinor <= 0)
    throw new Error("El precio debe ser mayor que cero.");
  validateConfig(config);

  const price = BigInt(publicPriceMinor);
  const commissionNumerator =
    price * BigInt(config.commissionBps) * BPS_DENOMINATOR;
  const commissionVatNumerator =
    price * BigInt(config.commissionBps) * BigInt(config.commissionVatBps);
  const processingTotalNumerator =
    price * BigInt(config.paymentProcessingBps) * BPS_DENOMINATOR +
    BigInt(config.paymentProcessingFixedMinor) * COMPOUND_BPS_DENOMINATOR;
  const partnerProcessingNumerator =
    price *
      BigInt(config.paymentProcessingBps) *
      BigInt(config.partnerProcessingShareBps) +
    BigInt(config.paymentProcessingFixedMinor) *
      BigInt(config.partnerProcessingShareBps) *
      BPS_DENOMINATOR;
  const adminPercentageNumerator =
    price * BigInt(config.adminFeeBps) * BPS_DENOMINATOR;

  // Round cumulative Partner deductions, then assign each marginal cent to the
  // next component in a stable waterfall. Independent ceilings can make two or
  // more deductions jump on the same public-price cent and reduce Partner net.
  // The waterfall preserves the configured exact rational amounts in aggregate,
  // makes forward pricing monotonic, and is shared by persisted SQL economics.
  const roundedCommission = ceilDivide(
    commissionNumerator,
    COMPOUND_BPS_DENOMINATOR,
  );
  const roundedCommissionAndVat = ceilDivide(
    commissionNumerator + commissionVatNumerator,
    COMPOUND_BPS_DENOMINATOR,
  );
  const roundedThroughPartnerProcessing = ceilDivide(
    commissionNumerator + commissionVatNumerator + partnerProcessingNumerator,
    COMPOUND_BPS_DENOMINATOR,
  );
  const roundedVariablePartnerDeductions = ceilDivide(
    commissionNumerator +
      commissionVatNumerator +
      partnerProcessingNumerator +
      adminPercentageNumerator,
    COMPOUND_BPS_DENOMINATOR,
  );

  const commissionMinor = toSafeMinorUnits(
    roundedCommission,
    "Comisión Marketplace",
  );
  const commissionVatMinor = toSafeMinorUnits(
    roundedCommissionAndVat - roundedCommission,
    "IVA sobre comisión",
  );
  const processingTotalMinor = toSafeMinorUnits(
    ceilDivide(processingTotalNumerator, COMPOUND_BPS_DENOMINATOR),
    "Procesamiento total",
  );
  const partnerProcessingShareMinor = toSafeMinorUnits(
    roundedThroughPartnerProcessing - roundedCommissionAndVat,
    "Procesamiento a cargo del Partner",
  );
  const bestRoundProcessingShareMinor =
    processingTotalMinor - partnerProcessingShareMinor;
  const adminPercentageFeeMinor = toSafeMinorUnits(
    roundedVariablePartnerDeductions - roundedThroughPartnerProcessing,
    "Fee administrativo porcentual",
  );
  const otherConfiguredFeesMinor = 0;
  const partnerDeductions =
    toSafeMinorUnits(
      roundedVariablePartnerDeductions,
      "Cargos variables del Partner",
    ) +
    config.adminFixedFeeMinor +
    otherConfiguredFeesMinor;
  const partnerNetMinor = publicPriceMinor - partnerDeductions;
  if (partnerNetMinor < 0) {
    throw new Error("Los cargos exceden el precio público.");
  }
  const grossBestRoundRevenueMinor =
    commissionMinor + adminPercentageFeeMinor + config.adminFixedFeeMinor;
  const estimatedBestRoundRevenueMinor =
    grossBestRoundRevenueMinor - bestRoundProcessingShareMinor;
  if (estimatedBestRoundRevenueMinor < 0) {
    throw new Error("La economía genera ingreso negativo para Best Round.");
  }
  const minimum = config.minimumMarketplaceRevenueMinor;

  return {
    publicPriceMinor,
    commissionBaseMinor: publicPriceMinor,
    commissionMinor,
    commissionVatMinor,
    processingTotalMinor,
    partnerProcessingShareMinor,
    bestRoundProcessingShareMinor,
    adminPercentageFeeMinor,
    adminFixedFeeMinor: config.adminFixedFeeMinor,
    otherConfiguredFeesMinor,
    partnerNetMinor,
    grossBestRoundRevenueMinor,
    taxPassThroughMinor: commissionVatMinor,
    estimatedBestRoundRevenueMinor,
    meetsMinimumMarketplaceRevenue:
      minimum === null ? null : estimatedBestRoundRevenueMinor >= minimum,
  };
}

export function solvePublicPriceForPartnerNet(
  desiredPartnerNetMinor: number,
  config: MarketplaceEconomicsConfig,
): MarketplaceEconomics {
  assertMinorUnits(desiredPartnerNetMinor, "Neto deseado");
  if (desiredPartnerNetMinor <= 0)
    throw new Error("El neto deseado debe ser mayor que cero.");
  validateConfig(config);

  let low = 1;
  let high = Math.max(desiredPartnerNetMinor + config.adminFixedFeeMinor, 100);
  while (true) {
    try {
      const result = calculateMarketplaceEconomics(high, config);
      if (result.partnerNetMinor >= desiredPartnerNetMinor) break;
    } catch {
      // A low candidate can be economically impossible; keep expanding.
    }
    if (high >= MAX_MARKETPLACE_PRICE_MINOR / 2)
      throw new Error("El neto deseado excede el límite permitido.");
    high *= 2;
  }
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    try {
      const result = calculateMarketplaceEconomics(middle, config);
      if (result.partnerNetMinor >= desiredPartnerNetMinor) high = middle;
      else low = middle + 1;
    } catch {
      low = middle + 1;
    }
  }
  return calculateMarketplaceEconomics(low, config);
}

export function resolveMarketplacePrice(input: {
  inputMode: MarketplacePricingInputMode;
  desiredPublicPriceMinor: number | null;
  desiredPartnerNetMinor: number | null;
  config: MarketplaceEconomicsConfig;
}): MarketplacePriceResolution {
  const { inputMode, desiredPublicPriceMinor, desiredPartnerNetMinor, config } =
    input;
  const economics =
    inputMode === "NET_PRIORITY"
      ? solvePublicPriceForPartnerNet(desiredPartnerNetMinor ?? 0, config)
      : calculateMarketplaceEconomics(desiredPublicPriceMinor ?? 0, config);
  return {
    inputMode,
    desiredPublicPriceMinor,
    desiredPartnerNetMinor,
    calculatedPublicPriceMinor: economics.publicPriceMinor,
    economics,
    desiredNetDeltaMinor:
      desiredPartnerNetMinor === null
        ? null
        : economics.partnerNetMinor - desiredPartnerNetMinor,
  };
}

export function classifyMarketplaceViability(input: {
  publicPriceMinor: number;
  recommendedPriceMinor: number | null;
  toleranceBps: number;
}): {
  viability: MarketplaceViability;
  marketDeltaBps: number | null;
  lowerBoundMinor: number | null;
  upperBoundMinor: number | null;
} {
  const { publicPriceMinor, recommendedPriceMinor, toleranceBps } = input;
  assertMinorUnits(publicPriceMinor, "Precio público");
  assertBasisPoints(toleranceBps, "Tolerancia de mercado");
  if (recommendedPriceMinor === null) {
    return {
      viability: "INSUFFICIENT_DATA",
      marketDeltaBps: null,
      lowerBoundMinor: null,
      upperBoundMinor: null,
    };
  }
  assertMinorUnits(recommendedPriceMinor, "Precio recomendado");
  if (recommendedPriceMinor <= 0)
    throw new Error("La referencia de mercado no es válida.");
  const delta = Number(
    (BigInt(publicPriceMinor - recommendedPriceMinor) * BigInt(10_000)) /
      BigInt(recommendedPriceMinor),
  );
  const lower = Number(
    (BigInt(recommendedPriceMinor) * BigInt(10_000 - toleranceBps)) /
      BigInt(10_000),
  );
  // Calculate the upper bound directly because basis-point helpers deliberately
  // reject rates at or above 10000.
  const upperExact = Number(
    (BigInt(recommendedPriceMinor) * BigInt(10_000 + toleranceBps) +
      BigInt(9_999)) /
      BigInt(10_000),
  );
  return {
    viability:
      publicPriceMinor < lower
        ? "UNDERPRICED"
        : publicPriceMinor > upperExact
          ? "OVERPRICED"
          : "COMPETITIVE",
    marketDeltaBps: delta,
    lowerBoundMinor: lower,
    upperBoundMinor: upperExact,
  };
}
