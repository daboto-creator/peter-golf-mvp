"use client";

import { useActionState } from "react";

import { CatalogFeedback } from "@/components/operations/catalog-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  adjustInventoryAction,
  initializeInventoryAction,
} from "@/lib/inventory/inventory-actions";
import { initialInventoryActionResult } from "@/lib/inventory/inventory-action-state";

export function InventoryInitializer({
  productId,
  variantId,
}: {
  productId: string;
  variantId: string;
}) {
  const [state, action, pending] = useActionState(
    initializeInventoryAction,
    initialInventoryActionResult,
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="variantId" value={variantId} />
      <p className="text-muted-foreground text-sm leading-6">
        La inicialización crea un saldo de cero. El primer cambio de cantidad se
        registrará después como movimiento auditable.
      </p>
      {state.message ? (
        <CatalogFeedback
          tone={state.status === "error" ? "error" : "success"}
          message={state.message}
        />
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Inicializando…" : "Inicializar inventario"}
      </Button>
    </form>
  );
}

export function InventoryAdjustmentForm({
  productId,
  variantId,
  quantityOnHand,
  initialIdempotencyKey,
}: {
  productId: string;
  variantId: string;
  quantityOnHand: number;
  initialIdempotencyKey: string;
}) {
  const [state, action, pending] = useActionState(
    adjustInventoryAction,
    initialInventoryActionResult,
  );
  return (
    <form
      action={action}
      className="space-y-5"
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        const delta = Number(data.get("quantityDelta"));
        if (
          delta < 0 &&
          !window.confirm(
            `Este movimiento reducirá el saldo físico de ${quantityOnHand} a ${quantityOnHand + delta}. ¿Continuar?`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="variantId" value={variantId} />
      <input
        type="hidden"
        name="idempotencyKey"
        value={state.nextIdempotencyKey ?? initialIdempotencyKey}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="movementType">Tipo de movimiento</Label>
          <select
            id="movementType"
            name="movementType"
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
            defaultValue="adjustment"
          >
            <option value="adjustment">Ajuste / corrección</option>
            <option value="receipt">Recepción (incremento)</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantityDelta">Cambio de unidades</Label>
          <Input
            id="quantityDelta"
            name="quantityDelta"
            type="number"
            step="1"
            min="-1000000"
            max="1000000"
            required
            placeholder="Ej. 5 o -2"
          />
          <p className="text-muted-foreground text-xs">
            Usa un valor negativo para reducir existencias. No se aceptan cero
            ni decimales.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reason">Motivo o nota</Label>
        <textarea
          id="reason"
          name="reason"
          required
          minLength={3}
          maxLength={500}
          className="border-input bg-background min-h-24 w-full rounded-md border px-3 py-2 text-sm"
          placeholder="Describe el conteo, recepción o corrección."
        />
      </div>

      <fieldset className="grid gap-5 rounded-lg border p-4 sm:grid-cols-2">
        <legend className="px-2 text-sm font-medium">
          Referencia opcional
        </legend>
        <div className="space-y-2">
          <Label htmlFor="referenceType">Tipo</Label>
          <Input
            id="referenceType"
            name="referenceType"
            maxLength={80}
            placeholder="Ej. conteo_fisico"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="referenceId">Identificador UUID</Label>
          <Input
            id="referenceId"
            name="referenceId"
            inputMode="text"
            placeholder="UUID relacionado"
          />
        </div>
      </fieldset>

      {state.message ? (
        <CatalogFeedback
          tone={state.status === "error" ? "error" : "success"}
          message={
            state.balance
              ? `${state.message} Saldo: ${state.balance.before} → ${state.balance.after}; disponible: ${state.balance.availableAfter}.`
              : state.message
          }
        />
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Registrando…" : "Registrar movimiento"}
      </Button>
    </form>
  );
}
