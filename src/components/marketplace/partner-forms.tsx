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
  saveBasicPartnerAction,
  saveFiscalPartnerAction,
  startPartnerAction,
  startIdentityVerificationAction,
  submitPartnerAction,
  uploadPartnerDocumentAction,
} from "@/lib/marketplace/partner-actions";
import {
  documentKindCopy,
  legalTypeCopy,
  type PartnerLegalType,
} from "@/lib/marketplace/partner-rules";

type BasicPartnerValues = {
  legal_type: PartnerLegalType;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  country_code: string | null;
  state: string | null;
  city: string | null;
  commercial_name: string | null;
  representative_name: string | null;
};

type FiscalPartnerValues = {
  legal_type: PartnerLegalType;
  tax_id: string | null;
  legal_name: string | null;
  fiscal_address_line_1: string | null;
  fiscal_address_line_2: string | null;
  fiscal_city: string | null;
  fiscal_state: string | null;
  fiscal_postal_code: string | null;
};

function Field({
  name,
  label,
  defaultValue,
  required,
  type = "text",
  autoComplete,
  readOnly,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label}
        {required ? " *" : ""}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        required={required}
        autoComplete={autoComplete}
        readOnly={readOnly}
      />
    </div>
  );
}

export function PartnerTypeForm() {
  const [state, action] = useActionState(
    startPartnerAction,
    initialPartnerActionState,
  );
  return (
    <form action={action} className="space-y-6">
      <fieldset className="grid gap-4">
        <legend className="sr-only">Tipo de Partner</legend>
        {Object.entries(legalTypeCopy).map(([key, copy]) => (
          <label
            key={key}
            className="has-checked:border-pg-gold has-checked:bg-pg-gold/5 cursor-pointer rounded-xl border bg-white p-5"
          >
            <span className="flex items-start gap-3">
              <input
                type="radio"
                name="legalType"
                value={key}
                required
                className="mt-1 accent-[var(--pg-gold)]"
              />
              <span>
                <strong className="block">{copy.label}</strong>
                <span className="text-muted-foreground mt-1 block text-sm leading-6">
                  {copy.description}
                </span>
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <ActionFeedback state={state} />
      <SubmitButton>Guardar y continuar</SubmitButton>
    </form>
  );
}

export function BasicPartnerForm({
  partner,
  defaults,
  email,
}: {
  partner: BasicPartnerValues;
  defaults?: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  } | null;
  email: string;
}) {
  const [state, action] = useActionState(
    saveBasicPartnerAction,
    initialPartnerActionState,
  );
  const company = partner.legal_type === "LEGAL_ENTITY";
  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          name="email_display"
          label="Email"
          defaultValue={email}
          readOnly
        />
        {company ? (
          <>
            <Field
              name="commercial_name"
              label="Razón social o nombre legal"
              defaultValue={partner.commercial_name}
              required
            />
            <Field
              name="representative_name"
              label="Representante"
              defaultValue={
                partner.representative_name ??
                [defaults?.first_name, defaults?.last_name]
                  .filter(Boolean)
                  .join(" ")
              }
              required
            />
          </>
        ) : (
          <>
            <Field
              name="first_name"
              label="Nombre"
              defaultValue={partner.first_name ?? defaults?.first_name}
              required
              autoComplete="given-name"
            />
            <Field
              name="last_name"
              label="Apellido"
              defaultValue={partner.last_name ?? defaults?.last_name}
              required
              autoComplete="family-name"
            />
          </>
        )}
        <Field
          name="phone"
          label="Teléfono"
          defaultValue={partner.phone ?? defaults?.phone}
          required
          type="tel"
          autoComplete="tel"
        />
        <Field
          name="country_code"
          label="País (código de 2 letras)"
          defaultValue={partner.country_code ?? "MX"}
          required
        />
        <Field
          name="state"
          label="Estado"
          defaultValue={partner.state}
          required
          autoComplete="address-level1"
        />
        <Field
          name="city"
          label="Ciudad"
          defaultValue={partner.city}
          required
          autoComplete="address-level2"
        />
      </div>
      <fieldset className="space-y-3 rounded-xl border p-4">
        <legend className="px-1 text-sm font-medium">Confirmaciones</legend>
        <label className="flex gap-3 text-sm">
          <input type="checkbox" name="terms_accepted" required />
          <span>Acepto los términos del programa Best Round Partner.</span>
        </label>
        <label className="flex gap-3 text-sm">
          <input type="checkbox" name="privacy_accepted" required />
          <span>Acepto el aviso de privacidad.</span>
        </label>
      </fieldset>
      <ActionFeedback state={state} />
      <SubmitButton>Continuar con verificación</SubmitButton>
    </form>
  );
}

export function IdentityVerificationForm({ label }: { label: string }) {
  const [state, action] = useActionState(
    startIdentityVerificationAction,
    initialPartnerActionState,
  );
  return (
    <form action={action} className="space-y-4">
      <ActionFeedback state={state} />
      <SubmitButton>{label}</SubmitButton>
    </form>
  );
}

export function FiscalPartnerForm({
  partner,
}: {
  partner: FiscalPartnerValues;
}) {
  const [state, action] = useActionState(
    saveFiscalPartnerAction,
    initialPartnerActionState,
  );
  const optional = partner.legal_type === "INDIVIDUAL";
  return (
    <form action={action} className="space-y-6">
      {optional ? (
        <p className="text-muted-foreground rounded-xl border bg-white p-4 text-sm">
          Para particulares, esta información es opcional en esta etapa.
        </p>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          name="tax_id"
          label="RFC"
          defaultValue={partner.tax_id}
          required={!optional}
        />
        <Field
          name="legal_name"
          label="Nombre o razón social fiscal"
          defaultValue={partner.legal_name}
          required={!optional}
        />
        <Field
          name="fiscal_address_line_1"
          label="Domicilio fiscal"
          defaultValue={partner.fiscal_address_line_1}
          required={!optional}
        />
        <Field
          name="fiscal_address_line_2"
          label="Interior / referencia"
          defaultValue={partner.fiscal_address_line_2}
        />
        <Field
          name="fiscal_city"
          label="Ciudad"
          defaultValue={partner.fiscal_city}
          required={!optional}
        />
        <Field
          name="fiscal_state"
          label="Estado"
          defaultValue={partner.fiscal_state}
          required={!optional}
        />
        <Field
          name="fiscal_postal_code"
          label="Código postal"
          defaultValue={partner.fiscal_postal_code}
          required={!optional}
        />
      </div>
      <p className="text-muted-foreground text-xs">
        La política fiscal definitiva y la retención de documentos están
        pendientes de revisión legal. No automatizamos CFDI en esta etapa.
      </p>
      <ActionFeedback state={state} />
      <SubmitButton>Guardar y continuar</SubmitButton>
    </form>
  );
}

export function DocumentUploadForm() {
  const [state, action] = useActionState(
    uploadPartnerDocumentAction,
    initialPartnerActionState,
  );
  return (
    <form action={action} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="document_kind">Tipo de documento</Label>
        <select
          id="document_kind"
          name="document_kind"
          required
          className="border-input h-11 w-full rounded-xl border bg-white px-3 text-sm"
        >
          <option value="">Selecciona una opción</option>
          {Object.entries(documentKindCopy).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="document">Archivo privado</Label>
        <Input
          id="document"
          name="document"
          type="file"
          required
          accept="application/pdf,image/jpeg,image/png,image/webp"
        />
        <p className="text-muted-foreground text-xs">
          PDF, JPEG, PNG o WebP. Máximo 10 MiB.
        </p>
      </div>
      <ActionFeedback state={state} />
      <SubmitButton>Subir documento</SubmitButton>
    </form>
  );
}

export function SubmitPartnerForm({ ready }: { ready: boolean }) {
  const [state, action] = useActionState(
    submitPartnerAction,
    initialPartnerActionState,
  );
  return (
    <form action={action} className="space-y-4">
      <ActionFeedback state={state} />
      <SubmitButton disabled={!ready}>
        {ready ? "Enviar a revisión" : "Completa los pendientes"}
      </SubmitButton>
    </form>
  );
}
