"use client";

import Link from "next/link";
import { useActionState } from "react";

import { ProductImage } from "@/components/catalog/product-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  changeCartItemAction,
  clearCartAction,
  removeCartItemAction,
} from "@/lib/cart/cart-actions";
import { initialCartActionResult } from "@/lib/cart/cart-action-state";
import type { CustomerCart } from "@/lib/cart/customer-cart";
import { formatMoneyMinorUnits } from "@/lib/catalog/presentation";

function ItemForm({
  item,
  version,
  updateKey,
  removeKey,
}: {
  item: CustomerCart["items"][number];
  version: number;
  updateKey: string;
  removeKey: string;
}) {
  const [updateState, updateAction, updating] = useActionState(
    changeCartItemAction,
    initialCartActionResult,
  );
  const [removeState, removeAction, removing] = useActionState(
    removeCartItemAction,
    initialCartActionResult,
  );
  const message = updateState.message || removeState.message;
  return (
    <div className="space-y-3">
      <form action={updateAction} className="flex items-end gap-2">
        <input type="hidden" name="itemId" value={item.id} />
        <input type="hidden" name="version" value={version} />
        <input type="hidden" name="idempotencyKey" value={updateKey} />
        <label className="space-y-1 text-xs font-medium">
          <span className="block">Cantidad</span>
          <Input
            className="w-24"
            name="quantity"
            type="number"
            min={1}
            max={99}
            defaultValue={item.quantity}
          />
        </label>
        <Button type="submit" variant="outline" disabled={updating}>
          {updating ? "Actualizando…" : "Actualizar"}
        </Button>
      </form>
      <form action={removeAction}>
        <input type="hidden" name="itemId" value={item.id} />
        <input type="hidden" name="version" value={version} />
        <input type="hidden" name="idempotencyKey" value={removeKey} />
        <Button
          type="submit"
          variant="ghost"
          className="px-0 text-red-700"
          disabled={removing}
        >
          {removing ? "Eliminando…" : "Eliminar partida"}
        </Button>
      </form>
      {message ? (
        <p role="status" className="text-sm text-red-700">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function CartView({
  cart,
  keys,
  clearKey,
}: {
  cart: CustomerCart;
  keys: Record<string, { update: string; remove: string }>;
  clearKey: string;
}) {
  const [clearState, clearAction, clearing] = useActionState(
    clearCartAction,
    initialCartActionResult,
  );
  if (!cart.cart_id || !cart.version || !cart.items.length) {
    return (
      <section className="rounded-2xl border border-dashed bg-white p-10 text-center">
        <h1 className="text-2xl font-semibold">Tu carrito está vacío</h1>
        <p className="text-muted-foreground mt-3">
          Explora el catálogo y agrega una variante para comenzar.
        </p>
        <Button asChild className="mt-6">
          <Link href="/productos">Ver productos</Link>
        </Button>
      </section>
    );
  }
  const currentVersion = cart.version;
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <section className="space-y-4" aria-label="Partidas del carrito">
        {cart.items.map((item) => (
          <article
            key={item.id}
            className="grid gap-5 rounded-xl border bg-white p-4 sm:grid-cols-[9rem_1fr]"
          >
            <ProductImage
              storagePath={item.image_path}
              alt={item.product_name}
              sizes="144px"
            />
            <div className="space-y-3">
              <div>
                <Link
                  href={item.slug ? `/productos/${item.slug}` : "/productos"}
                  className="font-semibold hover:underline"
                >
                  {item.product_name}
                </Link>
                <p className="text-muted-foreground text-sm">
                  {item.variant_name} · SKU {item.sku}
                </p>
              </div>
              <p className="font-medium">
                {formatMoneyMinorUnits(item.unit_price, cart.currency)} c/u
              </p>
              {item.price_changed ? (
                <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                  El precio cambió. Actualiza la cantidad para aceptar el precio
                  vigente.
                </p>
              ) : null}
              {item.availability !== "available" ? (
                <p className="text-sm text-amber-800">
                  {item.availability === "low"
                    ? "Pocas unidades disponibles."
                    : "La cantidad solicitada ya no está disponible."}
                </p>
              ) : null}
              <ItemForm
                item={item}
                version={currentVersion}
                updateKey={keys[item.id]!.update}
                removeKey={keys[item.id]!.remove}
              />
              <p className="text-right font-semibold">
                {formatMoneyMinorUnits(item.line_total, cart.currency)}
              </p>
            </div>
          </article>
        ))}
      </section>
      <aside className="h-fit space-y-5 rounded-xl border bg-white p-5 lg:sticky lg:top-5">
        <h2 className="text-xl font-semibold">Resumen</h2>
        <div className="flex justify-between">
          <span>{cart.unit_count} unidades</span>
          <strong>{formatMoneyMinorUnits(cart.subtotal, cart.currency)}</strong>
        </div>
        <p className="text-muted-foreground text-sm">
          El envío se suma en checkout. El carrito usa precios actuales y no
          reserva inventario.
        </p>
        {cart.has_issues ? (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            Revisa y actualiza las partidas marcadas antes de continuar.
          </p>
        ) : (
          <Button asChild size="lg" className="w-full">
            <Link href="/checkout">Continuar al checkout</Link>
          </Button>
        )}
        <Button asChild variant="outline" className="w-full">
          <Link href="/productos">Continuar comprando</Link>
        </Button>
        <form
          action={clearAction}
          onSubmit={(event) => {
            if (!window.confirm("¿Vaciar todo el carrito?"))
              event.preventDefault();
          }}
        >
          <input type="hidden" name="version" value={currentVersion} />
          <input type="hidden" name="idempotencyKey" value={clearKey} />
          <Button
            type="submit"
            variant="ghost"
            className="w-full text-red-700"
            disabled={clearing}
          >
            {clearing ? "Vaciando…" : "Vaciar carrito"}
          </Button>
        </form>
        {clearState.message ? (
          <p role="status" className="text-sm text-red-700">
            {clearState.message}
          </p>
        ) : null}
      </aside>
    </div>
  );
}
