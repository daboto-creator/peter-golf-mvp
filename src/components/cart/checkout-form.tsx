"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialCartActionResult } from "@/lib/cart/cart-action-state";
import { checkoutAction } from "@/lib/cart/cart-actions";
import type {
  CustomerAddress,
  CustomerCart,
  CustomerShippingMethod,
} from "@/lib/cart/customer-cart";
import { calculateCheckoutTotal } from "@/lib/cart/cart-rules";
import { formatMoneyMinorUnits } from "@/lib/catalog/presentation";

type AddressFields = {
  recipientName: string;
  phone: string;
  street: string;
  exteriorNumber: string;
  interiorNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  references: string;
};

const emptyAddress: AddressFields = {
  recipientName: "",
  phone: "",
  street: "",
  exteriorNumber: "",
  interiorNumber: "",
  neighborhood: "",
  city: "",
  state: "",
  postalCode: "",
  references: "",
};

function fromSaved(address: CustomerAddress): AddressFields {
  const match = address.exteriorNumber
    ? null
    : address.line1.match(/^(.*)\s+(\S+)$/);
  return {
    recipientName: address.recipientName,
    phone: address.phone ?? "",
    street: match?.[1] ?? address.line1,
    exteriorNumber: address.exteriorNumber ?? match?.[2] ?? "",
    interiorNumber: address.line2 ?? "",
    neighborhood: address.neighborhood ?? "",
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    references: address.references ?? "",
  };
}

export function CheckoutForm({
  cart,
  addresses,
  shippingMethod,
  idempotencyKey,
  paymentsMode,
}: {
  cart: CustomerCart & { cart_id: string; version: number };
  addresses: CustomerAddress[];
  shippingMethod: CustomerShippingMethod;
  idempotencyKey: string;
  paymentsMode: "disabled" | "test";
}) {
  const [state, action, pending] = useActionState(
    checkoutAction,
    initialCartActionResult,
  );
  const [address, setAddress] = useState<AddressFields>(
    addresses[0] ? fromSaved(addresses[0]) : emptyAddress,
  );
  const [savedAddressId, setSavedAddressId] = useState(addresses[0]?.id ?? "");
  const totals = calculateCheckoutTotal(
    cart.subtotal,
    shippingMethod.basePrice,
  );
  const update = (field: keyof AddressFields, value: string) => {
    setSavedAddressId("");
    setAddress((current) => ({ ...current, [field]: value }));
  };
  return (
    <form action={action} className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <input type="hidden" name="cartId" value={cart.cart_id} />
      <input type="hidden" name="version" value={cart.version} />
      <input type="hidden" name="shippingMethodId" value={shippingMethod.id} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="savedAddressId" value={savedAddressId} />
      <section className="space-y-6 rounded-xl border bg-white p-5 sm:p-7">
        <div>
          <h2 className="text-xl font-semibold">Dirección de envío</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Sólo realizamos envíos dentro de México en esta fase.
          </p>
        </div>
        {addresses.length ? (
          <label className="block space-y-2 text-sm font-medium">
            <span>Usar dirección guardada</span>
            <select
              value={savedAddressId}
              className="border-input h-11 w-full rounded-md border px-3"
              onChange={(event) => {
                const saved = addresses.find(
                  (item) => item.id === event.target.value,
                );
                setSavedAddressId(saved?.id ?? "");
                setAddress(saved ? fromSaved(saved) : emptyAddress);
              }}
            >
              <option value="">Capturar una dirección nueva</option>
              {addresses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} · {item.city}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Nombre del destinatario"
            name="recipientName"
            value={address.recipientName}
            onChange={update}
          />
          <Field
            label="Teléfono"
            name="phone"
            value={address.phone}
            onChange={update}
            inputMode="tel"
          />
          <Field
            label="Calle"
            name="street"
            value={address.street}
            onChange={update}
          />
          <Field
            label="Número exterior"
            name="exteriorNumber"
            value={address.exteriorNumber}
            onChange={update}
          />
          <Field
            label="Número interior (opcional)"
            name="interiorNumber"
            value={address.interiorNumber}
            onChange={update}
            required={false}
          />
          <Field
            label="Colonia"
            name="neighborhood"
            value={address.neighborhood}
            onChange={update}
          />
          <Field
            label="Ciudad o municipio"
            name="city"
            value={address.city}
            onChange={update}
          />
          <Field
            label="Estado"
            name="state"
            value={address.state}
            onChange={update}
          />
          <Field
            label="Código postal"
            name="postalCode"
            value={address.postalCode}
            onChange={update}
            inputMode="numeric"
          />
          <label className="space-y-2 text-sm font-medium sm:col-span-2">
            <span>Referencias (opcional)</span>
            <textarea
              name="references"
              value={address.references}
              onChange={(event) => update("references", event.target.value)}
              maxLength={500}
              className="border-input min-h-24 w-full rounded-md border p-3"
            />
          </label>
        </div>
        {!savedAddressId ? (
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="saveAddress" className="mt-1" />
            <span>Guardar esta dirección para futuras compras.</span>
          </label>
        ) : (
          <p className="text-muted-foreground text-sm">
            Usaremos la versión vigente de esta dirección guardada al generar el
            pedido.
          </p>
        )}
        <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-950">
          <fieldset className="space-y-2">
            <legend className="font-semibold">Método de pago</legend>
            <label className="flex items-start gap-3">
              <input
                type="radio"
                name="paymentMethod"
                value="bank_transfer"
                defaultChecked
                className="mt-1"
              />
              <span>Transferencia bancaria simulada</span>
            </label>
          </fieldset>
          <p className="mt-3">
            {paymentsMode === "test"
              ? "Flujo de prueba: no realizar una transferencia real. Operaciones confirmará primero el pedido."
              : "El registro de transferencias está deshabilitado. No se realizará ningún cargo."}
          </p>
        </div>
      </section>
      <aside className="h-fit space-y-5 rounded-xl border bg-white p-5 lg:sticky lg:top-5">
        <h2 className="text-xl font-semibold">Resumen del pedido</h2>
        <ul className="space-y-3 text-sm">
          {cart.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4">
              <span>
                {item.quantity} × {item.product_name} · {item.variant_name}
              </span>
              <strong>
                {formatMoneyMinorUnits(item.line_total, cart.currency)}
              </strong>
            </li>
          ))}
        </ul>
        <div className="space-y-2 border-t pt-4 text-sm">
          <Row
            label="Subtotal"
            amount={totals.subtotal}
            currency={cart.currency}
          />
          <Row
            label={shippingMethod.name}
            amount={totals.shipping}
            currency={cart.currency}
          />
          <Row label="Descuento" amount={0} currency={cart.currency} />
          <Row label="Impuestos" amount={0} currency={cart.currency} />
          <div className="flex justify-between pt-2 text-lg">
            <span>Total</span>
            <strong>
              {formatMoneyMinorUnits(totals.total, cart.currency)}
            </strong>
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          {shippingMethod.description} El inventario se revalidará al enviar,
          pero se descontará sólo cuando operación confirme.
        </p>
        {state.message ? (
          <p role="alert" className="text-sm text-red-700">
            {state.message}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Generando pedido…" : "Generar pedido para revisión"}
        </Button>
      </aside>
    </form>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  required = true,
  inputMode,
}: {
  label: string;
  name: keyof AddressFields;
  value: string;
  onChange: (field: keyof AddressFields, value: string) => void;
  required?: boolean;
  inputMode?: "tel" | "numeric";
}) {
  return (
    <label className="space-y-2 text-sm font-medium">
      <span>{label}</span>
      <Input
        name={name}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        required={required}
        inputMode={inputMode}
      />
    </label>
  );
}
function Row({
  label,
  amount,
  currency,
}: {
  label: string;
  amount: number;
  currency: string;
}) {
  return (
    <div className="flex justify-between gap-3">
      <span>{label}</span>
      <strong>{formatMoneyMinorUnits(amount, currency)}</strong>
    </div>
  );
}
