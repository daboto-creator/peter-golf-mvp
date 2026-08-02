"use client";

import { useActionState, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoneyMinorUnits } from "@/lib/catalog/presentation";
import { initialOrderActionResult } from "@/lib/orders/order-action-state";
import type {
  ManualOrderDetail,
  OrderCatalogOption,
} from "@/lib/orders/operational-orders";
import {
  createManualOrderAction,
  updateManualOrderAction,
} from "@/lib/orders/order-actions";

type Row = { key: string; variantId: string; quantity: number };

export function OrderForm({
  options,
  order,
  idempotencyKey,
}: {
  options: OrderCatalogOption[];
  order?: ManualOrderDetail;
  idempotencyKey: string;
}) {
  const action = order ? updateManualOrderAction : createManualOrderAction;
  const [state, formAction, pending] = useActionState(
    action,
    initialOrderActionResult,
  );
  const [rows, setRows] = useState<Row[]>(
    () =>
      order?.items.map((item) => ({
        key: item.id,
        variantId: item.variantId,
        quantity: item.quantity,
      })) ?? [
        { key: "initial", variantId: options[0]?.variantId ?? "", quantity: 1 },
      ],
  );
  const [shipping, setShipping] = useState(() =>
    order ? (order.shippingTotal / 100).toFixed(2) : "0.00",
  );
  const [discount, setDiscount] = useState(() =>
    order ? (order.discountTotal / 100).toFixed(2) : "0.00",
  );
  const optionMap = useMemo(
    () => new Map(options.map((option) => [option.variantId, option])),
    [options],
  );
  const subtotal = rows.reduce((sum, row) => {
    const option = optionMap.get(row.variantId);
    return (
      sum +
      (option?.price ?? 0) * (Number.isInteger(row.quantity) ? row.quantity : 0)
    );
  }, 0);
  const shippingMinor = /^\d+(?:\.\d{0,2})?$/.test(shipping)
    ? Math.round(Number(shipping) * 100)
    : 0;
  const discountMinor = /^\d+(?:\.\d{0,2})?$/.test(discount)
    ? Math.round(Number(discount) * 100)
    : 0;
  const address = order?.address;

  return (
    <form action={formAction} className="space-y-8">
      {order ? (
        <>
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="version" value={order.version} />
        </>
      ) : null}
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <section className="grid gap-5 rounded-xl border bg-white p-5 sm:p-6 md:grid-cols-2">
        <div className="md:col-span-2">
          <h2 className="text-xl font-semibold">Cliente</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Datos de contacto internos para esta venta manual.
          </p>
        </div>
        <Field
          label="Nombre completo"
          name="customerName"
          defaultValue={order?.customerName}
          required
        />
        <Field
          label="Teléfono"
          name="customerPhone"
          defaultValue={order?.customerPhone}
          required
        />
        <Field
          label="Correo (opcional)"
          name="customerEmail"
          type="email"
          defaultValue={order?.customerEmail ?? ""}
        />
        <div className="space-y-2">
          <Label htmlFor="originChannel">Canal de origen</Label>
          <select
            id="originChannel"
            name="originChannel"
            defaultValue={order?.channel ?? "whatsapp"}
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="instagram">Instagram</option>
            <option value="phone">Venta telefónica</option>
            <option value="in_person">Venta presencial</option>
            <option value="bank_transfer">Transferencia pendiente</option>
            <option value="other">Otro canal controlado</option>
          </select>
        </div>
        <Field
          label="Detalle si elegiste Otro"
          name="originChannelDetail"
          defaultValue={order?.originChannelDetail ?? ""}
        />
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="internalNote">Notas internas (opcional)</Label>
          <textarea
            id="internalNote"
            name="internalNote"
            defaultValue={order?.internalNote ?? ""}
            maxLength={2000}
            className="border-input min-h-24 w-full rounded-md border p-3 text-sm"
          />
        </div>
      </section>

      <section className="grid gap-5 rounded-xl border bg-white p-5 sm:p-6 md:grid-cols-2">
        <div className="md:col-span-2">
          <h2 className="text-xl font-semibold">Entrega por envío</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            La recolección no está habilitada por las reglas actuales.
          </p>
        </div>
        <Field
          label="Nombre del destinatario"
          name="recipientName"
          defaultValue={address?.recipientName ?? order?.customerName}
          required
        />
        <Field
          label="Teléfono del destinatario"
          name="recipientPhone"
          defaultValue={address?.phone ?? order?.customerPhone}
          required
        />
        <Field
          label="Calle"
          name="street"
          defaultValue={address?.street}
          required
        />
        <Field
          label="Número exterior"
          name="exteriorNumber"
          defaultValue={address?.exteriorNumber}
          required
        />
        <Field
          label="Número interior (opcional)"
          name="interiorNumber"
          defaultValue={address?.interiorNumber ?? ""}
        />
        <Field
          label="Colonia"
          name="neighborhood"
          defaultValue={address?.neighborhood}
          required
        />
        <Field
          label="Ciudad o municipio"
          name="city"
          defaultValue={address?.city}
          required
        />
        <Field
          label="Estado"
          name="state"
          defaultValue={address?.state}
          required
        />
        <Field
          label="Código postal"
          name="postalCode"
          inputMode="numeric"
          pattern="[0-9]{5}"
          defaultValue={address?.postalCode}
          required
        />
        <Field
          label="Referencias (opcional)"
          name="references"
          defaultValue={address?.references ?? ""}
        />
      </section>

      <section className="space-y-5 rounded-xl border bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Partidas</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              El precio vigente se consulta y congela en SQL al guardar.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setRows((current) => [
                ...current,
                {
                  key: crypto.randomUUID(),
                  variantId: options[0]?.variantId ?? "",
                  quantity: 1,
                },
              ])
            }
          >
            Agregar producto
          </Button>
        </div>
        {options.length === 0 ? (
          <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
            No hay variantes publicadas y operativas disponibles.
          </p>
        ) : null}
        <div className="space-y-4">
          {rows.map((row) => {
            const selected = optionMap.get(row.variantId);
            return (
              <div
                key={row.key}
                className="grid gap-3 rounded-lg border p-4 md:grid-cols-[minmax(0,1fr)_8rem_auto] md:items-end"
              >
                <div className="space-y-2">
                  <Label htmlFor={`variant-${row.key}`}>
                    Producto y variante
                  </Label>
                  <select
                    id={`variant-${row.key}`}
                    name="variantId"
                    value={row.variantId}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((item) =>
                          item.key === row.key
                            ? { ...item, variantId: event.target.value }
                            : item,
                        ),
                      )
                    }
                    className="border-input h-10 w-full rounded-md border px-3 text-sm"
                    required
                  >
                    {options.map((option) => (
                      <option key={option.variantId} value={option.variantId}>
                        {option.sku} · {option.name} · {option.variantName} ·{" "}
                        {formatMoneyMinorUnits(option.price, option.currency)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="hidden"
                    name="productId"
                    value={selected?.productId ?? ""}
                  />
                  <p className="text-muted-foreground text-xs">
                    {selected
                      ? `SKU ${selected.sku} · Disponible al confirmar: ${selected.available ?? "sin saldo inicializado"}`
                      : "Selecciona una variante."}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`quantity-${row.key}`}>Cantidad</Label>
                  <Input
                    id={`quantity-${row.key}`}
                    name="quantity"
                    type="number"
                    min={1}
                    max={1_000_000}
                    step={1}
                    value={row.quantity}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((item) =>
                          item.key === row.key
                            ? { ...item, quantity: Number(event.target.value) }
                            : item,
                        ),
                      )
                    }
                    required
                  />
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={rows.length === 1}
                  onClick={() =>
                    setRows((current) =>
                      current.filter((item) => item.key !== row.key),
                    )
                  }
                >
                  Quitar
                </Button>
                <p className="text-sm font-medium md:col-span-3">
                  Subtotal estimado:{" "}
                  {formatMoneyMinorUnits(
                    (selected?.price ?? 0) * row.quantity,
                    selected?.currency ?? "MXN",
                  )}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-5 rounded-xl border bg-white p-5 sm:p-6 md:grid-cols-2">
        <Field
          label="Costo de envío (MXN)"
          name="shipping"
          inputMode="decimal"
          value={shipping}
          onChange={(event) => setShipping(event.target.value)}
          required
        />
        <Field
          label="Descuento (MXN)"
          name="discount"
          inputMode="decimal"
          value={discount}
          onChange={(event) => setDiscount(event.target.value)}
          required
        />
        <Field
          label="Motivo del descuento"
          name="discountReason"
          defaultValue={order?.discountReason ?? ""}
        />
        <div className="rounded-lg bg-zinc-50 p-4 text-sm">
          <p>
            Subtotal estimado:{" "}
            <strong>{formatMoneyMinorUnits(subtotal)}</strong>
          </p>
          <p className="mt-2">
            Total estimado:{" "}
            <strong>
              {formatMoneyMinorUnits(
                Math.max(0, subtotal - discountMinor + shippingMinor),
              )}
            </strong>
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            SQL recalcula todos los importes con precios vigentes; esta vista no
            es la autoridad.
          </p>
        </div>
      </section>
      {state.status === "error" ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-4 text-sm text-red-800"
        >
          {state.message}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button
          size="lg"
          type="submit"
          disabled={pending || !idempotencyKey || options.length === 0}
        >
          {pending
            ? "Guardando…"
            : order
              ? "Guardar cambios"
              : "Crear pedido preliminar"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}
