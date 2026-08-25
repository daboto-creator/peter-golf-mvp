"use client";

import { useActionState } from "react";

import {
  ActionFeedback,
  SubmitButton,
} from "@/components/marketplace/action-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  completeMarketplaceAnalysisAction,
  createManualMarketplaceReferenceAction,
  createMarketplacePricingQuoteAction,
  requestMarketplaceAnalysisAction,
  requestMarketplaceAnalysisForOperationsAction,
  transitionMarketplacePricingAction,
} from "@/lib/marketplace/pricing-actions";
import { initialPartnerActionState } from "@/lib/marketplace/partner-action-state";

const fieldClass =
  "border-input min-h-11 w-full rounded-xl border bg-white px-3 py-2 text-sm";

export function RequestMarketplaceAnalysisForm(props: {
  listingId: string;
  listingVersionId: string;
  idempotencyKey: string;
}) {
  const [state, action] = useActionState(
    requestMarketplaceAnalysisAction,
    initialPartnerActionState,
  );
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="listing_id" value={props.listingId} />
      <input
        type="hidden"
        name="listing_version_id"
        value={props.listingVersionId}
      />
      <input
        type="hidden"
        name="idempotency_key"
        value={props.idempotencyKey}
      />
      <ActionFeedback state={state} />
      <SubmitButton>Solicitar referencia de mercado</SubmitButton>
    </form>
  );
}

export function RequestMarketplaceAnalysisForOperationsForm(props: {
  listingId: string;
  listingVersionId: string;
  idempotencyKey: string;
}) {
  const [state, action] = useActionState(
    requestMarketplaceAnalysisForOperationsAction,
    initialPartnerActionState,
  );
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="listing_id" value={props.listingId} />
      <input
        type="hidden"
        name="listing_version_id"
        value={props.listingVersionId}
      />
      <input
        type="hidden"
        name="idempotency_key"
        value={props.idempotencyKey}
      />
      <ActionFeedback state={state} />
      <SubmitButton>Actualizar referencia de mercado</SubmitButton>
    </form>
  );
}

export function MarketplacePricingQuoteForm(props: {
  listingId: string;
  listingVersionId: string;
  analysisId: string | null;
  idempotencyKey: string;
}) {
  const [state, action] = useActionState(
    createMarketplacePricingQuoteAction,
    initialPartnerActionState,
  );
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="listing_id" value={props.listingId} />
      <input
        type="hidden"
        name="listing_version_id"
        value={props.listingVersionId}
      />
      <input
        type="hidden"
        name="market_analysis_id"
        value={props.analysisId ?? ""}
      />
      <input
        type="hidden"
        name="idempotency_key"
        value={props.idempotencyKey}
      />
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">¿Qué quieres priorizar?</legend>
        <label className="flex items-start gap-3 rounded-xl border p-4">
          <input
            type="radio"
            name="input_mode"
            value="PUBLIC_PRICE_PRIORITY"
            defaultChecked
          />
          <span>
            <strong className="block">Precio al cliente</strong>
            <span className="text-muted-foreground text-sm">
              Calculamos cuánto recibirías después de cargos.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-xl border p-4">
          <input type="radio" name="input_mode" value="NET_PRIORITY" />
          <span>
            <strong className="block">Neto para ti</strong>
            <span className="text-muted-foreground text-sm">
              Resolvemos el precio público mínimo de forma determinística.
            </span>
          </span>
        </label>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="desired_public_price">Precio al cliente (MXN)</Label>
          <Input
            id="desired_public_price"
            name="desired_public_price"
            inputMode="decimal"
            placeholder="8500.00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="desired_partner_net">Quiero recibir (MXN)</Label>
          <Input
            id="desired_partner_net"
            name="desired_partner_net"
            inputMode="decimal"
            placeholder="7000.00"
          />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Si completas ambos importes, ninguno se cambia silenciosamente; la
        prioridad seleccionada gobierna el cálculo y conservamos la discrepancia
        para revisión.
      </p>
      <ActionFeedback state={state} />
      <SubmitButton>Calcular propuesta</SubmitButton>
    </form>
  );
}

export function PricingWorkflowForm(props: {
  quoteId: string;
  listingId: string;
  lockVersion: number;
  status:
    | "PARTNER_ACCEPTED"
    | "UNDER_REVIEW"
    | "CHANGES_REQUESTED"
    | "APPROVED"
    | "REJECTED";
  label: string;
  requireReason?: boolean;
}) {
  const [state, action] = useActionState(
    transitionMarketplacePricingAction,
    initialPartnerActionState,
  );
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="quote_id" value={props.quoteId} />
      <input type="hidden" name="listing_id" value={props.listingId} />
      <input type="hidden" name="lock_version" value={props.lockVersion} />
      <input type="hidden" name="status" value={props.status} />
      {props.requireReason ? (
        <div className="space-y-2">
          <Label htmlFor={`reason-${props.quoteId}-${props.status}`}>
            Motivo obligatorio
          </Label>
          <Input
            id={`reason-${props.quoteId}-${props.status}`}
            name="reason"
            required
            minLength={3}
            maxLength={1000}
          />
        </div>
      ) : (
        <input type="hidden" name="reason" value="" />
      )}
      <ActionFeedback state={state} />
      <SubmitButton>{props.label}</SubmitButton>
    </form>
  );
}

export function CompleteMarketplaceAnalysisForm({
  analysisId,
}: {
  analysisId: string;
}) {
  const [state, action] = useActionState(
    completeMarketplaceAnalysisAction,
    initialPartnerActionState,
  );
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="analysis_id" value={analysisId} />
      <ActionFeedback state={state} />
      <SubmitButton>Consultar provider ahora</SubmitButton>
    </form>
  );
}

export function ManualMarketplaceReferenceForm(props: {
  listingId: string;
  listingVersionId: string;
  idempotencyKey: string;
}) {
  const [state, action] = useActionState(
    createManualMarketplaceReferenceAction,
    initialPartnerActionState,
  );
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="listing_id" value={props.listingId} />
      <input
        type="hidden"
        name="listing_version_id"
        value={props.listingVersionId}
      />
      <input
        type="hidden"
        name="idempotency_key"
        value={props.idempotencyKey}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="manual-reference">Referencia (MXN)</Label>
          <Input id="manual-reference" name="reference_price" required />
        </div>
        <div>
          <Label htmlFor="manual-low">Rango bajo</Label>
          <Input id="manual-low" name="low_market" />
        </div>
        <div>
          <Label htmlFor="manual-high">Rango alto</Label>
          <Input id="manual-high" name="high_market" />
        </div>
      </div>
      <div>
        <Label htmlFor="manual-source">Fuente/evidencia</Label>
        <Input
          id="manual-source"
          name="source_description"
          required
          minLength={3}
          maxLength={300}
        />
      </div>
      <div>
        <Label htmlFor="manual-reason">Motivo</Label>
        <Input
          id="manual-reason"
          name="reason"
          required
          minLength={3}
          maxLength={1000}
        />
      </div>
      <ActionFeedback state={state} />
      <SubmitButton>Guardar referencia manual</SubmitButton>
    </form>
  );
}

export { fieldClass as marketplacePricingFieldClass };
