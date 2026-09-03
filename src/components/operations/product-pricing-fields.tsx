"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  useWatch,
  type Control,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { researchProductMarketAction } from "@/lib/catalog/market-research-actions";
import type { MarketResearchActionResult } from "@/lib/catalog/market-research-types";
import type {
  CatalogReference,
  OperationalPricingConfiguration,
} from "@/lib/catalog/operational-products";
import {
  minorUnitsToPriceInput,
  parseMoneyToMinorUnits,
  type ProductFormValues,
} from "@/lib/catalog/product-validation";
import { calculatePricing } from "@/lib/pricing/pricing-engine";
import type { MarketPriceResult } from "@/lib/pricing/market-price-provider";
import type { FirstPartyDecision } from "@/lib/pricing/intelligence-economics";
import { resolvePricingRule } from "@/lib/pricing/pricing-rules";
import type { MarketReference } from "@/lib/pricing/pricing-types";

const selectClassName =
  "border-input bg-background focus-visible:border-pg-gold h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50";
const moneyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

function money(value: number): string {
  return moneyFormatter.format(value / 100);
}

function percent(value: number): string {
  return `${(value / 100).toFixed(1)}%`;
}

function parseOptionalMoney(value: string): number | null {
  return value ? parseMoneyToMinorUnits(value) : null;
}

function stringOrNull(value: string | undefined): string | null {
  return value?.trim() ? value.trim() : null;
}

function numberOrNull(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function ProductPricingFields({
  mode,
  productId,
  categories,
  pricingConfiguration,
  control,
  register,
  setValue,
  fieldError,
}: {
  mode: "create" | "edit";
  productId?: string;
  categories: CatalogReference[];
  pricingConfiguration: OperationalPricingConfiguration;
  control: Control<ProductFormValues>;
  register: UseFormRegister<ProductFormValues>;
  setValue: UseFormSetValue<ProductFormValues>;
  fieldError: (name: keyof ProductFormValues) => string | undefined;
}) {
  const values = useWatch({ control });
  const [researchPending, startResearchTransition] = useTransition();
  const [researchFeedback, setResearchFeedback] = useState<{
    identityKey: string;
    value: MarketResearchActionResult;
  } | null>(null);
  const [marketResult, setMarketResult] = useState<{
    identityKey: string;
    value: MarketPriceResult;
  } | null>(null);
  const [intelligence, setIntelligence] = useState<{
    decision: FirstPartyDecision;
    research: {
      internalSalesUsed: number;
      cachedResearchUsed: boolean;
      mexicoQueriesExecuted: number;
      usaQueriesExecuted: number;
      acceptedComparables: unknown[];
    };
  } | null>(null);
  const enabled = values.pricingEnabled ?? false;
  const category = categories.find(
    (candidate) => candidate.id === values.categoryId,
  );
  const identityKey = JSON.stringify([
    values.brandId,
    values.categoryId,
    values.condition,
    values.conditionGrade,
    values.conditionScore,
    values.model,
    values.modelYear,
    values.clubNumber,
    values.loftDegrees,
    values.handedness,
    values.shaftMaterial,
    values.shaftBrand,
    values.shaftModel,
    values.shaftFlex,
  ]);
  const previousIdentityKey = useRef(identityKey);
  const latestIdentityKey = useRef(identityKey);
  const visibleResearchFeedback =
    researchFeedback?.identityKey === identityKey
      ? researchFeedback.value
      : null;
  const visibleMarketResult =
    marketResult?.identityKey === identityKey ? marketResult.value : null;

  useEffect(() => {
    latestIdentityKey.current = identityKey;
    if (previousIdentityKey.current !== identityKey) {
      previousIdentityKey.current = identityKey;
      if (values.marketResearchId) {
        setValue("marketReference", "", { shouldDirty: true });
        setValue("marketAverage", "", { shouldDirty: true });
        setValue("marketLow", "", { shouldDirty: true });
        setValue("marketHigh", "", { shouldDirty: true });
        setValue("marketSampleSize", "", { shouldDirty: true });
        setValue("marketConfidence", "unavailable", { shouldDirty: true });
        setValue("marketSource", "", { shouldDirty: true });
        setValue("marketSourceUrl", "", { shouldDirty: true });
        setValue("marketResearchId", "", { shouldDirty: true });
        setValue("marketProvider", "", { shouldDirty: true });
        setValue("marketCheckedAt", "", { shouldDirty: true });
      }
    }
  }, [identityKey, setValue, values.marketResearchId]);

  function applyMarketResult(result: MarketPriceResult, researchId: string) {
    const setMoney = (
      field: "marketReference" | "marketAverage" | "marketLow" | "marketHigh",
      value: number | null,
    ) =>
      setValue(field, minorUnitsToPriceInput(value), {
        shouldDirty: true,
        shouldValidate: true,
      });
    setMoney("marketReference", result.medianPriceMxn);
    setMoney("marketAverage", result.averagePriceMxn);
    setMoney("marketLow", result.lowPriceMxn);
    setMoney("marketHigh", result.highPriceMxn);
    setValue(
      "marketSampleSize",
      result.sampleSize ? String(result.sampleSize) : "",
      {
        shouldDirty: true,
        shouldValidate: true,
      },
    );
    setValue("marketConfidence", result.confidence, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("marketSource", result.source ?? "", {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("marketSourceUrl", result.sourceUrl ?? "", { shouldDirty: true });
    setValue("marketResearchId", researchId, { shouldDirty: true });
    setValue("marketProvider", result.provider, { shouldDirty: true });
    setValue("marketCheckedAt", result.checkedAt ?? "", { shouldDirty: true });
    setMarketResult({ identityKey, value: result });
  }

  function researchMarket(forceRefresh: boolean) {
    if (
      !values.brandId ||
      !values.categoryId ||
      !values.model ||
      !values.condition
    ) {
      setResearchFeedback({
        identityKey,
        value: {
          status: "error",
          message:
            "Completa marca, categoría, modelo y condición antes de consultar.",
        },
      });
      return;
    }
    const requestedIdentityKey = identityKey;
    startResearchTransition(async () => {
      const response = await researchProductMarketAction(
        {
          productId: productId ?? null,
          brandId: values.brandId!,
          categoryId: values.categoryId!,
          condition: values.condition!,
          conditionGrade: stringOrNull(values.conditionGrade),
          conditionScore: numberOrNull(values.conditionScore),
          targetPlayer: stringOrNull(values.targetPlayer),
          model: values.model!,
          modelYear: numberOrNull(values.modelYear),
          clubNumber: stringOrNull(values.clubNumber || values.ironNumber),
          loftDegrees: numberOrNull(values.loftDegrees),
          handedness: stringOrNull(values.handedness),
          shaftMaterial: stringOrNull(values.shaftMaterial),
          shaftBrand: stringOrNull(values.shaftBrand),
          shaftModel: stringOrNull(values.shaftModel),
          shaftFlex: stringOrNull(values.shaftFlex),
          acquisitionCost: values.acquisitionCost ?? "",
          conditioningCost: values.conditioningCost ?? "0",
          packagingCost: values.packagingCost ?? "0",
          shippingSubsidy: values.shippingSubsidy ?? "0",
        },
        forceRefresh,
      );
      if (latestIdentityKey.current !== requestedIdentityKey) return;
      setResearchFeedback({
        identityKey: requestedIdentityKey,
        value: response,
      });
      if (response.status !== "error")
        applyMarketResult(response.market, response.researchId);
      if (response.status !== "error") setIntelligence(response.intelligence);
    });
  }

  const preview = useMemo(() => {
    if (!enabled) return null;
    const acquisitionCost = parseMoneyToMinorUnits(
      values.acquisitionCost ?? "",
    );
    const conditioningCost = parseMoneyToMinorUnits(
      values.conditioningCost || "0",
    );
    const packagingCost = parseMoneyToMinorUnits(values.packagingCost || "0");
    const shippingSubsidy = parseMoneyToMinorUnits(
      values.shippingSubsidy || "0",
    );
    if (
      acquisitionCost === null ||
      acquisitionCost <= 0 ||
      conditioningCost === null ||
      packagingCost === null ||
      shippingSubsidy === null
    ) {
      return null;
    }
    const marketReference = parseOptionalMoney(values.marketReference ?? "");
    const market: MarketReference = marketReference
      ? {
          medianPriceMxn: marketReference,
          averagePriceMxn: parseOptionalMoney(values.marketAverage ?? ""),
          lowPriceMxn: parseOptionalMoney(values.marketLow ?? ""),
          highPriceMxn: parseOptionalMoney(values.marketHigh ?? ""),
          sampleSize: Number(values.marketSampleSize || 0),
          confidence:
            values.marketConfidence === "unavailable"
              ? "low"
              : (values.marketConfidence ?? "low"),
          source: values.marketSource || "Referencia manual",
          sourceUrl: values.marketSourceUrl || null,
          checkedAt: null,
        }
      : {
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
    const pricingRuleCode = resolvePricingRule({
      acquisitionChannel: values.acquisitionChannel ?? "purchase",
      condition: values.condition ?? "new",
      productFamily: values.productFamily || null,
      clubType: values.clubType || null,
      setType: values.setType || null,
      mappedNewRule: category?.newPricingRule,
      mappedUsedRule: category?.usedPricingRule,
      categorySlug: category?.slug,
    });
    try {
      const automatic = calculatePricing({
        costs: {
          acquisitionCost,
          conditioningCost,
          packagingCost,
          shippingSubsidy,
        },
        pricingRuleCode,
        targetReturnBps: pricingConfiguration.targetReturnBps[pricingRuleCode],
        paymentFee: pricingConfiguration.paymentFee,
        market,
      });
      const finalSalePrice = parseOptionalMoney(values.price ?? "");
      if (finalSalePrice === null) return automatic;
      try {
        return calculatePricing({
          costs: {
            acquisitionCost,
            conditioningCost,
            packagingCost,
            shippingSubsidy,
          },
          pricingRuleCode,
          targetReturnBps:
            pricingConfiguration.targetReturnBps[pricingRuleCode],
          paymentFee: pricingConfiguration.paymentFee,
          market,
          finalSalePrice,
          manualPriceReason: values.manualPriceReason,
          canPriceBelowFinancial: true,
        });
      } catch {
        return automatic;
      }
    } catch {
      return null;
    }
  }, [category, enabled, pricingConfiguration, values]);

  if (!enabled) {
    return (
      <section className="rounded-xl border border-dashed bg-white p-5 sm:p-6">
        <p className="text-pg-gold text-xs font-semibold tracking-[0.16em] uppercase">
          Pricing Best Round
        </p>
        <h2 className="mt-2 text-lg font-semibold">
          Producto legacy sin costos
        </h2>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
          Este producto continúa funcionando con su precio actual. Activa el
          motor cuando tengas el costo de adquisición; no se moverá el costo
          legacy de producto.
        </p>
        <label className="mt-4 flex min-h-11 items-center gap-3 text-sm font-medium">
          <input type="checkbox" {...register("pricingEnabled")} />
          Activar Pricing Best Round
        </label>
      </section>
    );
  }

  const ruleCode = preview
    ? resolvePricingRule({
        acquisitionChannel: values.acquisitionChannel ?? "purchase",
        condition: values.condition ?? "new",
        productFamily: values.productFamily || null,
        clubType: values.clubType || null,
        setType: values.setType || null,
        mappedNewRule: category?.newPricingRule,
        mappedUsedRule: category?.usedPricingRule,
        categorySlug: category?.slug,
      })
    : null;

  return (
    <section className="space-y-6 rounded-xl border bg-white p-5 sm:p-6">
      <input type="hidden" {...register("pricingEnabled")} />
      <input type="hidden" {...register("marketResearchId")} />
      <input type="hidden" {...register("marketProvider")} />
      <input type="hidden" {...register("marketCheckedAt")} />
      <input type="hidden" {...register("marketAverage")} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-pg-gold text-xs font-semibold tracking-[0.16em] uppercase">
            Pricing Best Round
          </p>
          <h2 className="mt-2 text-lg font-semibold">
            Costo, mercado y rentabilidad
          </h2>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-6">
            Cálculo interno en MXN. La vista es orientativa; el servidor vuelve
            a calcular y autorizar todo al guardar.
          </p>
        </div>
        {mode === "edit" ? (
          <span className="bg-pg-warm-white rounded-lg px-3 py-2 text-xs font-semibold">
            Historial automático
          </span>
        ) : null}
      </div>

      <div>
        <h3 className="text-sm font-semibold">Costos directos</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <PricingField
            id="acquisitionChannel"
            label="Canal de adquisición"
            error={fieldError("acquisitionChannel")}
          >
            <select
              id="acquisitionChannel"
              className={selectClassName}
              {...register("acquisitionChannel")}
            >
              <option value="purchase">Compra</option>
              <option value="trade_in">Trade-in</option>
            </select>
          </PricingField>
          <PricingField
            id="acquisitionCost"
            label="Costo adquisición"
            error={fieldError("acquisitionCost")}
          >
            <Input
              id="acquisitionCost"
              inputMode="decimal"
              {...register("acquisitionCost")}
            />
          </PricingField>
          <PricingField
            id="conditioningCost"
            label="Reacondicionamiento"
            error={fieldError("conditioningCost")}
          >
            <Input
              id="conditioningCost"
              inputMode="decimal"
              {...register("conditioningCost")}
            />
          </PricingField>
          <PricingField
            id="packagingCost"
            label="Empaque"
            error={fieldError("packagingCost")}
          >
            <Input
              id="packagingCost"
              inputMode="decimal"
              {...register("packagingCost")}
            />
          </PricingField>
          <PricingField
            id="shippingSubsidy"
            label="Subsidio envío"
            error={fieldError("shippingSubsidy")}
          >
            <Input
              id="shippingSubsidy"
              inputMode="decimal"
              {...register("shippingSubsidy")}
            />
          </PricingField>
        </div>
        <div className="bg-pg-warm-white mt-4 grid gap-3 rounded-xl p-4 text-sm sm:grid-cols-3">
          <Metric
            label="Costo total"
            value={preview ? money(preview.totalDirectCost) : "—"}
          />
          <Metric label="Regla" value={ruleCode ?? "Pendiente de categoría"} />
          <Metric
            label="Target ROC"
            value={
              ruleCode
                ? percent(pricingConfiguration.targetReturnBps[ruleCode])
                : "—"
            }
          />
        </div>
      </div>

      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold">Mercado México</h3>
            <p className="text-muted-foreground mt-1 text-xs">
              Comparables reales de Google Shopping México; la referencia manual
              permanece disponible.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={researchPending}
            onClick={() => researchMarket(false)}
          >
            {researchPending
              ? "Buscando precios comparables..."
              : mode === "edit"
                ? "Actualizar referencia de mercado"
                : visibleResearchFeedback?.status === "unavailable"
                  ? "Reintentar"
                  : "Calcular precio Best Round"}
          </Button>
        </div>
        {visibleResearchFeedback ? (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              visibleResearchFeedback.status === "error"
                ? "bg-destructive/10 text-destructive"
                : "bg-pg-warm-white text-pg-charcoal"
            }`}
            role="status"
          >
            {visibleResearchFeedback.message}
          </p>
        ) : null}
        {intelligence ? <IntelligenceCard intelligence={intelligence} /> : null}
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PricingField
            id="marketReference"
            label="Referencia mediana"
            error={fieldError("marketReference")}
          >
            <Input
              id="marketReference"
              inputMode="decimal"
              {...register("marketReference")}
            />
          </PricingField>
          <PricingField
            id="marketLow"
            label="Rango bajo"
            error={fieldError("marketLow")}
          >
            <Input
              id="marketLow"
              inputMode="decimal"
              {...register("marketLow")}
            />
          </PricingField>
          <PricingField
            id="marketHigh"
            label="Rango alto"
            error={fieldError("marketHigh")}
          >
            <Input
              id="marketHigh"
              inputMode="decimal"
              {...register("marketHigh")}
            />
          </PricingField>
          <PricingField
            id="marketSampleSize"
            label="Muestra"
            error={fieldError("marketSampleSize")}
          >
            <Input
              id="marketSampleSize"
              inputMode="numeric"
              {...register("marketSampleSize")}
            />
          </PricingField>
          <PricingField
            id="marketConfidence"
            label="Confianza"
            error={fieldError("marketConfidence")}
          >
            <select
              id="marketConfidence"
              className={selectClassName}
              {...register("marketConfidence")}
            >
              <option value="unavailable">No disponible</option>
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
            </select>
          </PricingField>
          <PricingField
            id="marketSource"
            label="Fuente"
            error={fieldError("marketSource")}
          >
            <Input
              id="marketSource"
              placeholder="Comercio o referencia"
              {...register("marketSource")}
            />
          </PricingField>
          <PricingField
            id="marketSourceUrl"
            label="URL / identificador"
            error={fieldError("marketSourceUrl")}
            className="sm:col-span-2"
          >
            <Input id="marketSourceUrl" {...register("marketSourceUrl")} />
          </PricingField>
        </div>
        {visibleMarketResult ? (
          <div className="bg-pg-warm-white mt-4 rounded-xl p-4">
            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label="Mediana"
                value={
                  visibleMarketResult.medianPriceMxn
                    ? money(visibleMarketResult.medianPriceMxn)
                    : "—"
                }
              />
              <Metric
                label="Promedio"
                value={
                  visibleMarketResult.averagePriceMxn
                    ? money(visibleMarketResult.averagePriceMxn)
                    : "—"
                }
              />
              <Metric
                label="Rango observado"
                value={
                  visibleMarketResult.lowPriceMxn &&
                  visibleMarketResult.highPriceMxn
                    ? `${money(visibleMarketResult.lowPriceMxn)} – ${money(visibleMarketResult.highPriceMxn)}`
                    : "—"
                }
              />
              <Metric
                label="Comparables válidos"
                value={String(visibleMarketResult.sampleSize)}
              />
              <Metric
                label="Confianza"
                value={visibleMarketResult.confidence.toUpperCase()}
              />
              <Metric
                label="Actualizado"
                value={
                  visibleMarketResult.checkedAt
                    ? new Intl.DateTimeFormat("es-MX", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(visibleMarketResult.checkedAt))
                    : "—"
                }
              />
            </div>
            {visibleMarketResult.sources.length ? (
              <details className="mt-4">
                <summary className="focus-visible:ring-pg-gold cursor-pointer rounded text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none">
                  Ver fuentes ({visibleMarketResult.sources.length})
                </summary>
                <ul className="mt-3 space-y-3">
                  {visibleMarketResult.sources.map((source, index) => (
                    <li
                      key={`${source.identifier ?? source.productName}-${index}`}
                      className="border-t pt-3 text-sm first:border-t-0 first:pt-0"
                    >
                      <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                        <span className="font-medium">
                          {source.productName}
                        </span>
                        <span>{money(source.priceMxn)}</span>
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {source.merchant} · Match {source.matchScore}/100 ·{" "}
                        {source.availability.replaceAll("_", " ")} ·{" "}
                        {source.marketScope.replaceAll("_", " ")}
                      </p>
                      {source.url ? (
                        <a
                          className="text-pg-gold mt-1 inline-block text-xs font-semibold hover:underline"
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir fuente
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="border-t pt-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Precio financiero mínimo"
            value={preview ? money(preview.financialPrice) : "—"}
          />
          <Metric
            label="Precio recomendado"
            value={preview ? money(preview.automaticSuggestedPrice) : "—"}
            accent
          />
          <Metric
            label="Fee estimado"
            value={preview ? money(preview.estimatedPaymentFee) : "—"}
          />
          <Metric
            label="Status"
            value={
              intelligence
                ? intelligence.decision.semaphore === "GREEN"
                  ? "RECOMENDABLE"
                  : intelligence.decision.semaphore === "YELLOW"
                    ? "REVISAR"
                    : "NO RECOMENDABLE"
                : (preview?.status ?? "Pendiente")
            }
          />
          <Metric
            label="Utilidad esperada"
            value={preview ? money(preview.expectedContribution) : "—"}
          />
          <Metric
            label="Retorno sobre costo"
            value={preview ? percent(preview.returnOnCostBps) : "—"}
          />
          <Metric
            label="Margen sobre venta"
            value={preview ? percent(preview.marginOnSaleBps) : "—"}
          />
          <Metric
            label="Semáforo"
            value={
              intelligence
                ? intelligence.decision.semaphore
                : preview && preview.marketLowerBound !== null
                  ? preview.health
                  : "REVISAR"
            }
          />
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <PricingField
            id="price"
            label="Precio de venta final (MXN)"
            error={fieldError("price")}
          >
            <Input
              id="price"
              inputMode="decimal"
              placeholder="1250.00"
              {...register("price")}
            />
          </PricingField>
          <Button
            type="button"
            variant="outline"
            disabled={!preview}
            onClick={() => {
              if (preview) {
                setValue(
                  "price",
                  minorUnitsToPriceInput(preview.automaticSuggestedPrice),
                  {
                    shouldDirty: true,
                    shouldValidate: true,
                  },
                );
              }
            }}
          >
            Usar recomendado
          </Button>
        </div>
        <div className="mt-4">
          <PricingField
            id="manualPriceReason"
            label="Motivo de precio manual"
            error={fieldError("manualPriceReason")}
          >
            <Input
              id="manualPriceReason"
              placeholder="Obligatorio para admin debajo del mínimo financiero"
              {...register("manualPriceReason")}
            />
          </PricingField>
        </div>
      </div>
    </section>
  );
}

function PricingField({
  id,
  label,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      <div className="mt-2">{children}</div>
      {error ? (
        <p className="text-destructive mt-1 text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={
          accent ? "text-pg-gold mt-1 font-semibold" : "mt-1 font-semibold"
        }
      >
        {value}
      </p>
    </div>
  );
}

function IntelligenceCard({
  intelligence,
}: {
  intelligence: {
    decision: FirstPartyDecision;
    research: {
      internalSalesUsed: number;
      cachedResearchUsed: boolean;
      mexicoQueriesExecuted: number;
      usaQueriesExecuted: number;
      acceptedComparables: unknown[];
    };
  };
}) {
  const { decision, research } = intelligence;
  const semaphoreLabel =
    decision.semaphore === "GREEN"
      ? "🟢 Recomendable"
      : decision.semaphore === "YELLOW"
        ? "🟡 Revisar"
        : "🔴 No recomendable";
  const confidence =
    decision.confidence === "HIGH"
      ? "Alta"
      : decision.confidence === "MEDIUM"
        ? "Media"
        : "Baja";
  const rotation =
    decision.rotation === "FAST"
      ? "Rápida"
      : decision.rotation === "MEDIUM"
        ? "Media"
        : decision.rotation === "SLOW"
          ? "Lenta"
          : "Sin datos";
  return (
    <div className="bg-pg-warm-white mt-4 rounded-xl border p-4">
      <p className="text-pg-gold text-xs font-semibold tracking-[0.16em] uppercase">
        Best Round Intelligence
      </p>
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Semáforo" value={semaphoreLabel} />
        <Metric
          label="Precio recomendado"
          value={
            decision.recommendedPriceMinor === null
              ? "Sin referencia suficiente"
              : `${money(decision.recommendedPriceMinor)} MXN`
          }
          accent
        />
        <Metric
          label="Mercado"
          value={
            decision.marketLowMinor !== null &&
            decision.marketHighMinor !== null
              ? `${money(decision.marketLowMinor)} – ${money(decision.marketHighMinor)} MXN`
              : "Sin referencia suficiente"
          }
        />
        <Metric
          label="Margen esperado"
          value={
            decision.expectedMarginBps === null
              ? "—"
              : percent(decision.expectedMarginBps)
          }
        />
        <Metric label="Rotación" value={rotation} />
        <Metric label="Confianza" value={confidence} />
        <Metric
          label="Ventas Best Round"
          value={String(research.internalSalesUsed)}
        />
        <Metric
          label="Investigación reciente"
          value={research.cachedResearchUsed ? "Sí" : "No"}
        />
        <Metric label="México" value={String(research.mexicoQueriesExecuted)} />
        <Metric
          label="USA respaldo"
          value={research.usaQueriesExecuted > 0 ? "Sí" : "No"}
        />
        <Metric
          label="Comparables válidos"
          value={String(research.acceptedComparables.length)}
        />
      </div>
      <p className="text-muted-foreground mt-4 text-sm">
        {decision.explanation}
      </p>
    </div>
  );
}
