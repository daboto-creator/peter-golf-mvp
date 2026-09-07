"use client";

import { useId, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  findGolfModelSuggestions,
  resolveGolfModel,
  type GolfModelSuggestion,
} from "@/lib/catalog/golf-equipment-reference";

type Props = {
  id: string;
  models: GolfModelSuggestion[];
  brandId: string;
  categoryId: string;
  value: string;
  canonicalModelId: string;
  manualMode: boolean;
  disabled?: boolean;
  onChange: (value: string, canonicalModelId: string) => void;
  onManualModeChange: (manual: boolean) => void;
};

export function GolfModelCombobox({
  id,
  models,
  brandId,
  categoryId,
  value,
  canonicalModelId,
  manualMode,
  disabled = false,
  onChange,
  onManualModeChange,
}: Props) {
  const datalistId = `golf-models-${useId().replace(/:/g, "")}`;
  const filtersReady = Boolean(brandId && categoryId);
  const suggestions = useMemo(
    () =>
      filtersReady
        ? findGolfModelSuggestions(models, value, brandId, categoryId).slice(
            0,
            50,
          )
        : [],
    [brandId, categoryId, filtersReady, models, value],
  );

  return (
    <div className="space-y-2">
      <Input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={suggestions.length > 0 && !manualMode}
        aria-controls={!manualMode ? datalistId : undefined}
        aria-describedby={`${id}-help`}
        list={!manualMode && filtersReady ? datalistId : undefined}
        value={value}
        disabled={disabled || (!filtersReady && !manualMode)}
        autoComplete="off"
        placeholder={
          manualMode
            ? "Escribe el modelo tal como aparece en el producto"
            : filtersReady
              ? "Busca un modelo canónico"
              : "Selecciona categoría y marca primero"
        }
        onChange={(event) => {
          const nextValue = event.target.value;
          if (manualMode) {
            onChange(nextValue, "");
            return;
          }
          const resolution = resolveGolfModel(
            models,
            nextValue,
            brandId,
            categoryId,
          );
          onChange(
            nextValue,
            resolution.status === "EXACT_MATCH"
              ? (resolution.canonical?.id ?? "")
              : "",
          );
        }}
      />
      {!manualMode ? (
        <datalist id={datalistId}>
          {suggestions.map((model) => (
            <option key={model.id} value={model.name} />
          ))}
        </datalist>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={`${id}-help`} className="text-muted-foreground text-xs">
          {canonicalModelId
            ? "Modelo canónico seleccionado."
            : manualMode
              ? "Se guardará como captura manual pendiente de revisión."
              : "Selecciona una sugerencia o usa la captura manual."}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => onManualModeChange(!manualMode)}
        >
          {manualMode ? "Volver a modelos sugeridos" : "No encuentro mi modelo"}
        </Button>
      </div>
    </div>
  );
}
