"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import type { PartnerActionState } from "@/lib/marketplace/partner-action-state";

const initial: PartnerActionState = { status: "idle", message: "" };

export function PayableActionForm({
  action,
  payableId,
  idempotencyKey,
  label,
  mode,
  holdId,
  maxAmountCents,
}: {
  action: (
    state: PartnerActionState,
    data: FormData,
  ) => Promise<PartnerActionState>;
  payableId: string;
  idempotencyKey: string;
  label: string;
  mode: "hold" | "release-hold" | "release" | "reverse";
  holdId?: string;
  maxAmountCents?: number;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form action={formAction} className="space-y-3 rounded-xl border p-4">
      <input type="hidden" name="payableId" value={payableId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {holdId ? <input type="hidden" name="holdId" value={holdId} /> : null}
      {mode === "hold" ? (
        <>
          <label className="block text-sm font-medium">
            Fuente
            <select
              name="source"
              className="border-input mt-2 h-11 w-full rounded-xl border bg-white px-3"
              defaultValue="OPERATIONS"
            >
              <option value="OPERATIONS">Operaciones</option>
              <option value="RISK">Riesgo</option>
              <option value="RECONCILIATION">Conciliación</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="partnerVisible" value="true" />
            Mostrar motivo al Partner
          </label>
          <input type="hidden" name="partnerVisible" value="false" />
        </>
      ) : null}
      {mode === "reverse" ? (
        <label className="block text-sm font-medium">
          Monto a revertir (centavos)
          <input
            name="amountCents"
            type="number"
            min={1}
            max={maxAmountCents}
            required
            defaultValue={maxAmountCents}
            className="border-input mt-2 h-11 w-full rounded-xl border px-3"
          />
        </label>
      ) : null}
      <label className="block text-sm font-medium">
        Motivo
        <textarea
          name="reason"
          required
          minLength={3}
          maxLength={1000}
          className="border-input mt-2 min-h-24 w-full rounded-xl border p-3"
        />
      </label>
      <Button type="submit" disabled={pending} variant="outline">
        {pending ? "Procesando…" : label}
      </Button>
      {state.status !== "idle" ? (
        <p
          role="status"
          className={
            state.status === "error"
              ? "text-destructive text-sm"
              : "text-sm text-emerald-700"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
