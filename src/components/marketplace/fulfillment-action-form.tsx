"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import type { PartnerActionState } from "@/lib/marketplace/partner-action-state";

const initial: PartnerActionState = { status: "idle", message: "" };

export function FulfillmentActionForm({
  action,
  fulfillmentId,
  version,
  idempotencyKey,
  operation,
  label,
  requireReason = false,
}: {
  action: (
    state: PartnerActionState,
    data: FormData,
  ) => Promise<PartnerActionState>;
  fulfillmentId: string;
  version: number;
  idempotencyKey: string;
  operation: string;
  label: string;
  requireReason?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form action={formAction} className="space-y-3 rounded-xl border p-4">
      <input type="hidden" name="fulfillmentId" value={fulfillmentId} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="action" value={operation} />
      {requireReason ? (
        <label className="block text-sm font-medium">
          Motivo
          <textarea
            name="reason"
            required
            minLength={3}
            maxLength={500}
            className="border-input mt-2 min-h-24 w-full rounded-xl border p-3"
          />
        </label>
      ) : (
        <input type="hidden" name="reason" value="Actualización Partner" />
      )}
      <Button
        type="submit"
        disabled={pending}
        variant={requireReason ? "outline" : "default"}
      >
        {pending ? "Guardando…" : label}
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
