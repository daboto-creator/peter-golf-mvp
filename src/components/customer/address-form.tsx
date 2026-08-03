"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialAddressActionResult } from "@/lib/customer/address-action-state";
import { saveAddressAction } from "@/lib/customer/address-actions";
import type { CustomerAddress } from "@/lib/customer/customer-data";

export function AddressForm({ address }: { address?: CustomerAddress }) {
  const [state, action, pending] = useActionState(
    saveAddressAction,
    initialAddressActionResult,
  );
  const error = (name: string) => state.errors?.[name]?.[0];
  return (
    <form action={action} className="space-y-6">
      {address ? (
        <input type="hidden" name="addressId" value={address.id} />
      ) : null}
      {address ? (
        <input type="hidden" name="version" value={address.version} />
      ) : null}
      {state.message ? (
        <Alert
          variant={state.status === "success" ? "success" : "destructive"}
          aria-live="polite"
        >
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <AddressField
          label="Etiqueta"
          name="label"
          defaultValue={address?.label}
          error={error("label")}
          autoComplete="off"
        />
        <AddressField
          label="Nombre del destinatario"
          name="recipientName"
          defaultValue={address?.recipientName}
          error={error("recipientName")}
          autoComplete="name"
        />
        <AddressField
          label="Teléfono"
          name="phone"
          defaultValue={address?.phone}
          error={error("phone")}
          autoComplete="tel"
          inputMode="tel"
        />
        <AddressField
          label="Calle"
          name="street"
          defaultValue={address?.street}
          error={error("street")}
          autoComplete="address-line1"
        />
        <AddressField
          label="Número exterior"
          name="exteriorNumber"
          defaultValue={address?.exteriorNumber}
          error={error("exteriorNumber")}
          autoComplete="off"
        />
        <AddressField
          label="Número interior (opcional)"
          name="interiorNumber"
          defaultValue={address?.interiorNumber ?? ""}
          error={error("interiorNumber")}
          required={false}
          autoComplete="address-line2"
        />
        <AddressField
          label="Colonia"
          name="neighborhood"
          defaultValue={address?.neighborhood}
          error={error("neighborhood")}
          autoComplete="off"
        />
        <AddressField
          label="Ciudad o municipio"
          name="city"
          defaultValue={address?.city}
          error={error("city")}
          autoComplete="address-level2"
        />
        <AddressField
          label="Estado"
          name="state"
          defaultValue={address?.state}
          error={error("state")}
          autoComplete="address-level1"
        />
        <AddressField
          label="Código postal"
          name="postalCode"
          defaultValue={address?.postalCode}
          error={error("postalCode")}
          autoComplete="postal-code"
          inputMode="numeric"
        />
        <label className="space-y-2 text-sm font-medium sm:col-span-2">
          <span>Referencias (opcional)</span>
          <textarea
            name="references"
            defaultValue={address?.references ?? ""}
            maxLength={500}
            className="border-input min-h-24 w-full rounded-md border p-3"
          />
        </label>
      </div>
      <input type="hidden" name="countryCode" value="MX" />
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="isDefault"
          defaultChecked={address?.isDefault}
        />
        Marcar como dirección predeterminada
      </label>
      <Button type="submit" size="lg" disabled={pending}>
        {pending
          ? "Guardando…"
          : address
            ? "Guardar cambios"
            : "Guardar dirección"}
      </Button>
    </form>
  );
}

function AddressField({
  label,
  name,
  defaultValue = "",
  error,
  required = true,
  autoComplete,
  inputMode,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  error?: string;
  required?: boolean;
  autoComplete: string;
  inputMode?: "tel" | "numeric";
}) {
  const errorId = `${name}-error`;
  return (
    <label className="space-y-2 text-sm font-medium">
      <span>{label}</span>
      <Input
        name={name}
        defaultValue={defaultValue}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      {error ? (
        <span
          id={errorId}
          role="alert"
          className="text-destructive block text-sm"
        >
          {error}
        </span>
      ) : null}
    </label>
  );
}
