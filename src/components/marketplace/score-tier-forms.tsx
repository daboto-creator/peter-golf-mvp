"use client";

import { useActionState } from "react";

import {
  ActionFeedback,
  SubmitButton,
} from "@/components/marketplace/action-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addPartnerPenaltyAction,
  clearPartnerOverrideAction,
  clearPartnerPenaltyAction,
  createPartnerOverrideAction,
  recalculatePartnerScoreAction,
} from "@/lib/marketplace/score-tier-actions";
import { initialPartnerActionState } from "@/lib/marketplace/partner-action-state";

const fieldClass =
  "border-input h-11 w-full rounded-xl border bg-white px-3 text-sm";

export function RecalculateScoreForm({ partnerId }: { partnerId: string }) {
  const [state, action] = useActionState(
    recalculatePartnerScoreAction,
    initialPartnerActionState,
  );
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="partner_id" value={partnerId} />
      <Label htmlFor="recalculation-reason">Motivo</Label>
      <Input
        id="recalculation-reason"
        name="reason"
        required
        minLength={3}
        maxLength={500}
        defaultValue="Revisión manual de evidencia vigente"
      />
      <ActionFeedback state={state} />
      <SubmitButton>Recalcular Score</SubmitButton>
    </form>
  );
}

export function AddPenaltyForm({ partnerId }: { partnerId: string }) {
  const [state, action] = useActionState(
    addPartnerPenaltyAction,
    initialPartnerActionState,
  );
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="partner_id" value={partnerId} />
      <Label htmlFor="event-code">Incidente estructurado</Label>
      <select
        id="event-code"
        name="event_code"
        className={fieldClass}
        required
        defaultValue=""
      >
        <option value="" disabled>
          Selecciona
        </option>
        <option value="REPEATED_LATE_SHIPMENT">Despacho tardío repetido</option>
        <option value="POST_PAYMENT_CANCELLATION">Cancelación post-pago</option>
        <option value="MAJOR_MISMATCH">Diferencia material</option>
        <option value="PARTNER_ATTRIBUTABLE_RETURN">
          Devolución atribuible
        </option>
        <option value="LOST_PARTNER_ATTRIBUTABLE_DISPUTE">
          Disputa atribuible perdida
        </option>
        <option value="CONFIRMED_COUNTERFEIT">Falsificación confirmada</option>
        <option value="DELIBERATE_MANIPULATION">Manipulación deliberada</option>
      </select>
      <Label htmlFor="penalty-reason">Evidencia / motivo</Label>
      <Input
        id="penalty-reason"
        name="reason"
        required
        minLength={3}
        maxLength={500}
      />
      <ActionFeedback state={state} />
      <SubmitButton>Registrar penalización</SubmitButton>
    </form>
  );
}

export function ClearPenaltyForm({
  partnerId,
  penaltyId,
}: {
  partnerId: string;
  penaltyId: string;
}) {
  const [state, action] = useActionState(
    clearPartnerPenaltyAction,
    initialPartnerActionState,
  );
  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="partner_id" value={partnerId} />
      <input type="hidden" name="penalty_id" value={penaltyId} />
      <Label htmlFor={`clear-penalty-${penaltyId}`}>Motivo para liberar</Label>
      <Input
        id={`clear-penalty-${penaltyId}`}
        name="reason"
        required
        minLength={3}
        maxLength={500}
      />
      <ActionFeedback state={state} />
      <SubmitButton>Liberar</SubmitButton>
    </form>
  );
}

export function CreateOverrideForm({ partnerId }: { partnerId: string }) {
  const [state, action] = useActionState(
    createPartnerOverrideAction,
    initialPartnerActionState,
  );
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="partner_id" value={partnerId} />
      <div>
        <Label htmlFor="override-type">Tipo</Label>
        <select
          id="override-type"
          name="override_type"
          className={fieldClass}
          required
          defaultValue="SCORE"
        >
          <option value="SCORE">Score</option>
          <option value="TIER">Tier</option>
        </select>
      </div>
      <div>
        <Label htmlFor="override-score">Score 0–100</Label>
        <Input
          id="override-score"
          name="score"
          type="number"
          min="0"
          max="100"
          defaultValue="80"
        />
      </div>
      <div>
        <Label htmlFor="override-tier">Tier</Label>
        <select
          id="override-tier"
          name="tier"
          className={fieldClass}
          defaultValue="BOGEY"
        >
          <option value="BOGEY">Bogey</option>
          <option value="PAR">Par</option>
          <option value="BIRDIE">Birdie</option>
          <option value="ALBATROSS">Albatross</option>
          <option value="HOLE_IN_ONE">Hole in One</option>
        </select>
      </div>
      <div>
        <Label htmlFor="override-expiry">Expira (opcional)</Label>
        <Input id="override-expiry" name="expires_at" type="date" />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="override-reason">Motivo obligatorio</Label>
        <Input
          id="override-reason"
          name="reason"
          required
          minLength={3}
          maxLength={500}
        />
      </div>
      <div className="space-y-3 sm:col-span-2">
        <ActionFeedback state={state} />
        <SubmitButton>Crear override</SubmitButton>
      </div>
    </form>
  );
}

export function ClearOverrideForm({
  partnerId,
  overrideId,
}: {
  partnerId: string;
  overrideId: string;
}) {
  const [state, action] = useActionState(
    clearPartnerOverrideAction,
    initialPartnerActionState,
  );
  return (
    <form action={action} className="mt-3 flex flex-col gap-2 sm:flex-row">
      <input type="hidden" name="partner_id" value={partnerId} />
      <input type="hidden" name="override_id" value={overrideId} />
      <Input
        name="reason"
        aria-label="Motivo para liberar override"
        required
        minLength={3}
        maxLength={500}
        placeholder="Motivo para liberar"
      />
      <ActionFeedback state={state} />
      <SubmitButton>Liberar override</SubmitButton>
    </form>
  );
}
