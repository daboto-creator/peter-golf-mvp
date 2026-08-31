"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function ShipmentConfirmationForm({
  action,
  fulfillmentId,
  version,
  idempotencyKey,
}: {
  action: (
    state: PartnerActionState,
    data: FormData,
  ) => Promise<PartnerActionState>;
  fulfillmentId: string;
  version: number;
  idempotencyKey: string;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [handoffIso, setHandoffIso] = useState("");
  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border p-5 md:col-span-2"
    >
      <input type="hidden" name="fulfillmentId" value={fulfillmentId} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="handoffAt" value={handoffIso} />
      <div>
        <h2 className="font-semibold">Tu producto está listo para enviar</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Registra los datos cuando entregues el paquete al transportista.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="carrier">Transportista</Label>
          <Input
            id="carrier"
            name="carrier"
            required
            minLength={2}
            maxLength={80}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="trackingNumber">Número de guía / tracking</Label>
          <Input
            id="trackingNumber"
            name="trackingNumber"
            required
            minLength={3}
            maxLength={120}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="handoffAt">
            Fecha y hora de entrega al transportista
          </Label>
          <Input
            id="handoffAt"
            name="handoffLocal"
            type="datetime-local"
            required
            onChange={(event) => {
              const local = new Date(event.currentTarget.value);
              setHandoffIso(
                Number.isNaN(local.getTime()) ? "" : local.toISOString(),
              );
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="shipmentNote">Nota opcional</Label>
          <Input id="shipmentNote" name="note" maxLength={500} />
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Confirmando…" : "Confirmar envío"}
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
