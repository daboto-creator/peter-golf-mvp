"use client";

import { useActionState } from "react";

import {
  ActionFeedback,
  SubmitButton,
} from "@/components/marketplace/action-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialPartnerActionState } from "@/lib/marketplace/partner-action-state";
import {
  reviewPartnerDocumentAction,
  reanalyzePartnerDocumentAction,
  transitionPartnerStatusAction,
} from "@/lib/marketplace/partner-actions";

export function DocumentReviewForm({
  documentId,
  version,
}: {
  documentId: string;
  version: number;
}) {
  const [state, action] = useActionState(
    reviewPartnerDocumentAction,
    initialPartnerActionState,
  );
  return (
    <form action={action} className="mt-4 grid gap-3">
      <input type="hidden" name="document_id" value={documentId} />
      <input type="hidden" name="version" value={version} />
      <Label htmlFor={`document-status-${documentId}`}>Decisión</Label>
      <select
        id={`document-status-${documentId}`}
        name="status"
        required
        className="border-input h-10 rounded-xl border bg-white px-3 text-sm"
      >
        <option value="UNDER_REVIEW">En revisión</option>
        <option value="VERIFIED">Aprobar</option>
        <option value="REJECTED">Solicitar actualización</option>
      </select>
      <Label htmlFor={`document-reason-${documentId}`}>Motivo</Label>
      <Input
        id={`document-reason-${documentId}`}
        name="reason"
        minLength={3}
        maxLength={500}
        required
      />
      <ActionFeedback state={state} />
      <SubmitButton>Guardar revisión</SubmitButton>
    </form>
  );
}

export function ReanalyzeDocumentForm({ documentId }: { documentId: string }) {
  const [state, action] = useActionState(
    reanalyzePartnerDocumentAction,
    initialPartnerActionState,
  );
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="document_id" value={documentId} />
      <ActionFeedback state={state} />
      <SubmitButton>Reanalizar documento</SubmitButton>
    </form>
  );
}

export function PartnerStatusForm({
  partnerId,
  version,
  options,
}: {
  partnerId: string;
  version: number;
  options: Array<[string, string]>;
}) {
  const [state, action] = useActionState(
    transitionPartnerStatusAction,
    initialPartnerActionState,
  );
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="partner_id" value={partnerId} />
      <input type="hidden" name="version" value={version} />
      <div className="space-y-2">
        <Label htmlFor="partner-status">Nuevo estado</Label>
        <select
          id="partner-status"
          name="status"
          required
          className="border-input h-11 w-full rounded-xl border bg-white px-3 text-sm"
        >
          <option value="">Selecciona</option>
          {options.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="partner-reason">Motivo obligatorio</Label>
        <Input
          id="partner-reason"
          name="reason"
          minLength={3}
          maxLength={500}
          required
        />
      </div>
      <ActionFeedback state={state} />
      <SubmitButton>Actualizar estado</SubmitButton>
    </form>
  );
}
