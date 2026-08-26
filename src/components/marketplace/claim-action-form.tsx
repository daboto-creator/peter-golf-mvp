"use client";

import { useActionState } from "react";

import {
  BUYER_CLAIM_REASONS,
  claimReasonLabel,
} from "@/lib/marketplace/claim-rules";
import type { PartnerActionState } from "@/lib/marketplace/partner-action-state";

type Action = (
  state: PartnerActionState,
  formData: FormData,
) => Promise<PartnerActionState>;

const initial: PartnerActionState = { status: "idle", message: "" };

export function BuyerAcceptanceForm({
  acceptAction,
  claimAction,
  fulfillmentId,
  orderItemId,
  idempotencyKey,
}: {
  acceptAction: Action;
  claimAction: Action;
  fulfillmentId: string;
  orderItemId: string;
  idempotencyKey: string;
}) {
  const [acceptState, acceptFormAction, accepting] = useActionState(
    acceptAction,
    initial,
  );
  const [claimState, claimFormAction, claiming] = useActionState(
    claimAction,
    initial,
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form
        action={acceptFormAction}
        className="rounded-xl border bg-white p-5"
      >
        <input type="hidden" name="fulfillmentId" value={fulfillmentId} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        <h3 className="font-semibold">¿Todo correcto?</h3>
        <p className="text-muted-foreground mt-2 text-sm">
          Confirma únicamente cuando hayas revisado el artículo.
        </p>
        <button
          disabled={accepting}
          className="mt-4 min-h-11 rounded-xl bg-black px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          Todo correcto
        </button>
      </form>
      <form
        action={claimFormAction}
        className="space-y-3 rounded-xl border bg-white p-5"
      >
        <input type="hidden" name="orderItemId" value={orderItemId} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        <h3 className="font-semibold">Tengo un problema</h3>
        <select
          name="reason"
          aria-label="Motivo del problema"
          required
          className="border-input min-h-11 w-full rounded-xl border px-3"
        >
          {BUYER_CLAIM_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {claimReasonLabel(reason)}
            </option>
          ))}
        </select>
        <textarea
          name="description"
          aria-label="Descripción del problema"
          required
          minLength={10}
          maxLength={2000}
          placeholder="Describe brevemente qué ocurrió"
          className="border-input min-h-28 w-full rounded-xl border p-3"
        />
        <button
          disabled={claiming}
          className="min-h-11 rounded-xl border border-black px-4 text-sm font-semibold disabled:opacity-60"
        >
          Enviar a Best Round
        </button>
      </form>
      {acceptState.message || claimState.message ? (
        <p role="status" className="text-sm lg:col-span-2">
          {acceptState.message || claimState.message}
        </p>
      ) : null}
    </div>
  );
}

export function ClaimWorkflowForm({
  action,
  claimId,
  idempotencyKey,
  mode,
}: {
  action: Action;
  claimId: string;
  idempotencyKey: string;
  mode: "partner-response" | "review" | "resolve";
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form
      action={formAction}
      className="space-y-3 rounded-xl border bg-white p-5"
    >
      <input type="hidden" name="claimId" value={claimId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {mode === "partner-response" ? (
        <textarea
          name="response"
          aria-label="Respuesta para Best Round"
          required
          minLength={10}
          maxLength={2000}
          placeholder="Información para Best Round"
          className="border-input min-h-28 w-full rounded-xl border p-3"
        />
      ) : null}
      {mode === "review" ? (
        <select
          name="status"
          aria-label="Estado de revisión"
          className="border-input min-h-11 w-full rounded-xl border px-3"
        >
          <option value="UNDER_REVIEW">En revisión</option>
          <option value="EVIDENCE_REQUESTED">Solicitar evidencia</option>
          <option value="PARTNER_RESPONSE_PENDING">
            Solicitar respuesta Partner
          </option>
        </select>
      ) : null}
      {mode === "resolve" ? (
        <>
          <select
            name="decision"
            aria-label="Decisión del reclamo"
            className="border-input min-h-11 w-full rounded-xl border px-3"
          >
            <option value="REJECTED">Rechazar</option>
            <option value="APPROVED">Aprobar total</option>
            <option value="PARTIALLY_APPROVED">Aprobar parcial</option>
          </select>
          <select
            name="responsibility"
            aria-label="Responsabilidad del reclamo"
            className="border-input min-h-11 w-full rounded-xl border px-3"
          >
            <option value="NO_FAULT">Sin responsabilidad Partner</option>
            <option value="PARTNER_RESPONSIBLE">Partner responsable</option>
            <option value="BUYER_NOT_SUPPORTED">Solicitud no soportada</option>
            <option value="BEST_ROUND_OPERATIONAL">Best Round operativo</option>
            <option value="INCONCLUSIVE">Inconcluso</option>
          </select>
          <input
            name="adjustmentCents"
            type="number"
            min="0"
            defaultValue="0"
            className="border-input min-h-11 w-full rounded-xl border px-3"
            aria-label="Ajuste parcial en centavos"
          />
          <select
            name="returnRequirement"
            aria-label="Requisito de devolución"
            className="border-input min-h-11 w-full rounded-xl border px-3"
          >
            <option value="NO_RETURN_REQUIRED">Sin devolución</option>
            <option value="RETURN_REQUIRED">Devolución requerida</option>
            <option value="RETURN_WAIVED">Devolución dispensada</option>
            <option value="MANUAL_REVIEW">Decisión manual</option>
          </select>
          <textarea
            name="evidenceSummary"
            aria-label="Resumen de evidencia"
            required
            minLength={3}
            maxLength={2000}
            placeholder="Resumen de evidencia"
            className="border-input min-h-24 w-full rounded-xl border p-3"
          />
          <textarea
            name="buyerOutcome"
            aria-label="Resultado para el comprador"
            required
            minLength={3}
            maxLength={1000}
            placeholder="Resultado para el comprador"
            className="border-input min-h-24 w-full rounded-xl border p-3"
          />
        </>
      ) : null}
      {mode !== "partner-response" ? (
        <textarea
          name="reason"
          aria-label="Motivo auditado"
          required
          minLength={3}
          maxLength={2000}
          placeholder="Motivo auditado"
          className="border-input min-h-24 w-full rounded-xl border p-3"
        />
      ) : null}
      <button
        disabled={pending}
        className="min-h-11 rounded-xl bg-black px-4 text-sm font-semibold text-white disabled:opacity-60"
      >
        {mode === "resolve"
          ? "Registrar resolución"
          : mode === "review"
            ? "Actualizar revisión"
            : "Enviar respuesta"}
      </button>
      {state.message ? (
        <p role="status" className="text-sm">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function ClaimEvidenceForm({
  action,
  claimId,
  idempotencyKey,
}: {
  action: Action;
  claimId: string;
  idempotencyKey: string;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form
      action={formAction}
      className="space-y-3 rounded-xl border bg-white p-5"
    >
      <input type="hidden" name="claimId" value={claimId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <label
        className="block text-sm font-medium"
        htmlFor={`evidence-${claimId}`}
      >
        Evidencia privada
      </label>
      <input
        id={`evidence-${claimId}`}
        name="evidence"
        type="file"
        required
        accept="image/jpeg,image/png,image/webp"
        className="block min-h-11 w-full text-sm"
      />
      <input
        name="note"
        aria-label="Nota de evidencia"
        maxLength={500}
        placeholder="Nota opcional"
        className="border-input min-h-11 w-full rounded-xl border px-3"
      />
      <p className="text-muted-foreground text-xs">
        JPEG, PNG o WebP · máximo 10 MB. Best Round controla quién puede verla.
      </p>
      <button
        disabled={pending}
        className="min-h-11 rounded-xl border border-black px-4 text-sm font-semibold disabled:opacity-60"
      >
        Agregar evidencia
      </button>
      {state.message ? (
        <p role="status" className="text-sm">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function EvidenceVisibilityForm({
  action,
  claimId,
  evidenceId,
  partnerVisible,
  idempotencyKey,
}: {
  action: Action;
  claimId: string;
  evidenceId: string;
  partnerVisible: boolean;
  idempotencyKey: string;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="claimId" value={claimId} />
      <input type="hidden" name="evidenceId" value={evidenceId} />
      <input
        type="hidden"
        name="partnerVisible"
        value={partnerVisible ? "false" : "true"}
      />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input
        type="hidden"
        name="reason"
        value="Visibilidad de evidencia revisada por Operations."
      />
      <button
        disabled={pending}
        className="min-h-10 rounded-lg border px-3 text-sm font-medium disabled:opacity-60"
      >
        {partnerVisible ? "Ocultar al Partner" : "Compartir con Partner"}
      </button>
      {state.message ? <p role="status">{state.message}</p> : null}
    </form>
  );
}

export function ReturnWorkflowForm({
  action,
  claimId,
  returnId,
  currentStatus,
  idempotencyKey,
}: {
  action: Action;
  claimId: string;
  returnId: string;
  currentStatus: string;
  idempotencyKey: string;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const nextStatuses: Record<string, { value: string; label: string }[]> = {
    AUTHORIZED: [{ value: "AWAITING_SHIPMENT", label: "Esperando envío" }],
    AWAITING_SHIPMENT: [{ value: "IN_TRANSIT", label: "En tránsito" }],
    IN_TRANSIT: [{ value: "RECEIVED", label: "Recibida" }],
    RECEIVED: [{ value: "INSPECTING", label: "En inspección" }],
    INSPECTING: [
      { value: "ACCEPTED", label: "Aceptada" },
      { value: "REJECTED", label: "Rechazada" },
    ],
    ACCEPTED: [{ value: "CLOSED", label: "Cerrada" }],
    REJECTED: [{ value: "CLOSED", label: "Cerrada" }],
  };
  const options = nextStatuses[currentStatus] ?? [];
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="claimId" value={claimId} />
      <input type="hidden" name="returnId" value={returnId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <select
        name="status"
        aria-label="Nuevo estado de devolución"
        className="border-input min-h-11 rounded-xl border px-3"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <input
        name="carrier"
        aria-label="Transportista"
        placeholder="Transportista si aplica"
        className="border-input min-h-11 rounded-xl border px-3"
      />
      <input
        name="trackingNumber"
        aria-label="Número de rastreo"
        placeholder="Rastreo si aplica"
        className="border-input min-h-11 rounded-xl border px-3"
      />
      <input
        name="inspectionResult"
        aria-label="Resultado de inspección"
        placeholder="Resultado de inspección si aplica"
        className="border-input min-h-11 rounded-xl border px-3"
      />
      <textarea
        name="reason"
        aria-label="Motivo de transición"
        required
        minLength={3}
        maxLength={1000}
        placeholder="Motivo auditado"
        className="border-input min-h-24 rounded-xl border p-3 sm:col-span-2"
      />
      <button
        disabled={pending || options.length === 0}
        className="min-h-11 rounded-xl bg-black px-4 text-sm font-semibold text-white disabled:opacity-60"
      >
        Actualizar devolución
      </button>
      {state.message ? <p role="status">{state.message}</p> : null}
    </form>
  );
}
