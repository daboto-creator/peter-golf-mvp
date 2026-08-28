"use client";

import Image from "next/image";
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
import {
  marketplaceCartIssueMessage,
  productSourceLabel,
} from "@/lib/marketplace/publication-rules";

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
      <form action={updateAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="itemId" value={item.id} />
        <input type="hidden" name="version" value={version} />
        <input type="hidden" name="idempotencyKey" value={updateKey} />
        <label className="space-y-1 text-xs font-medium">
          <span className="block">Cantidad</span>
          <Input
            className="w-24 bg-white"
            name="quantity"
            type="number"
            min={1}
            max={99}
            defaultValue={item.quantity}
          />
        </label>
        {item.marketplace_issue === "listing_changed" ? (
          <label className="flex min-h-11 items-center gap-2 text-xs">
            <input type="checkbox" name="acceptListingUpdate" required />
            <span>Revisé la versión actualizada de este artículo.</span>
          </label>
        ) : null}
        <Button type="submit" variant="outline" disabled={updating}>
          {updating
            ? "Actualizando…"
            : item.marketplace_issue === "price_changed"
              ? "Aceptar precio vigente"
              : "Actualizar"}
        </Button>
      </form>
      <form action={removeAction}>
        <input type="hidden" name="itemId" value={item.id} />
        <input type="hidden" name="version" value={version} />
        <input type="hidden" name="idempotencyKey" value={removeKey} />
        <Button
          type="submit"
          variant="ghost"
          className="min-h-11 px-0 text-red-700 hover:bg-transparent hover:text-red-800"
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
      <section className="grid overflow-hidden rounded-[20px] border bg-white md:grid-cols-[1fr_0.9fr]">
        <div className="flex flex-col justify-center px-6 py-12 text-center sm:px-10 md:text-left">
          <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
            Mi Bolsa
          </p>
          <h2 className="font-heading text-pg-black mt-4 text-3xl font-bold sm:text-4xl">
            Tu Bolsa está vacía
          </h2>
          <p className="text-muted-foreground mt-4 max-w-lg leading-7">
            Explora el Pro Shop y agrega el equipo que tenga sentido para tu
            juego.
          </p>
          <Button asChild className="mt-7 self-center md:self-start">
            <Link href="/productos">Explorar el Pro Shop</Link>
          </Button>
        </div>
        <figure className="relative min-h-64 md:min-h-80">
          <Image
            src="/images/home/pro-shop-equipment-temporary.jpg"
            alt="Bolsa y equipo de golf en una composición editorial"
            fill
            sizes="(max-width: 767px) calc(100vw - 2rem), 42vw"
            className="object-cover"
          />
          <figcaption className="absolute right-4 bottom-4 rounded-lg bg-black/65 px-3 py-2 text-[0.65rem] tracking-[0.12em] text-white uppercase">
            Imagen editorial
          </figcaption>
        </figure>
      </section>
    );
  }
  const currentVersion = cart.version;
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-10">
      <section className="space-y-4" aria-label="Productos en Mi Bolsa">
        {cart.items.map((item) => (
          <article
            key={item.id}
            className="grid gap-5 rounded-[20px] border bg-white p-4 sm:grid-cols-[10rem_1fr] sm:p-5"
          >
            <ProductImage
              storagePath={item.image_path}
              alt={item.product_name}
              sizes="(max-width: 639px) 208px, 160px"
              className="mx-auto aspect-square w-full max-w-52 sm:mx-0 sm:max-w-none"
            />
            <div className="space-y-3">
              <div>
                <Link
                  href={item.slug ? `/productos/${item.slug}` : "/productos"}
                  className="text-pg-black focus-visible:ring-pg-gold rounded-md text-lg font-semibold hover:underline focus-visible:ring-2 focus-visible:outline-none"
                >
                  {item.product_name}
                </Link>
                <p className="text-muted-foreground text-sm">
                  {item.variant_name} · SKU {item.sku}
                </p>
                <p className="text-pg-gold mt-1 text-xs font-semibold">
                  {productSourceLabel[item.item_source]}
                </p>
              </div>
              <p className="text-pg-charcoal font-semibold">
                {formatMoneyMinorUnits(item.unit_price, cart.currency)} c/u
              </p>
              {item.marketplace_issue !== "none" ? (
                <p className="rounded-xl border border-amber-700/20 bg-amber-50 p-3 text-sm text-amber-900">
                  {marketplaceCartIssueMessage(item.marketplace_issue)}
                </p>
              ) : item.price_changed ? (
                <p className="rounded-xl border border-amber-700/20 bg-amber-50 p-3 text-sm text-amber-900">
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
              <p className="border-border border-t pt-3 text-right text-lg font-semibold">
                {formatMoneyMinorUnits(item.line_total, cart.currency)}
              </p>
            </div>
          </article>
        ))}
      </section>
      <aside className="h-fit space-y-5 rounded-[20px] border bg-white p-5 sm:p-6 lg:sticky lg:top-36">
        <p className="text-pg-gold text-xs font-semibold tracking-[0.16em] uppercase">
          Antes de continuar
        </p>
        <h2 className="font-heading text-2xl font-bold">Resumen de Mi Bolsa</h2>
        <div className="border-border flex justify-between border-y py-4">
          <span>{cart.unit_count} unidades</span>
          <strong>{formatMoneyMinorUnits(cart.subtotal, cart.currency)}</strong>
        </div>
        <p className="text-muted-foreground text-sm">
          El envío se suma en checkout. El carrito usa precios actuales y no
          reserva inventario.
        </p>
        {cart.has_issues ? (
          <p className="rounded-xl border border-amber-700/20 bg-amber-50 p-3 text-sm text-amber-900">
            Revisa y actualiza las partidas marcadas antes de continuar.
          </p>
        ) : (
          <Button asChild size="lg" className="w-full">
            <Link href="/checkout">Continuar con mi pedido</Link>
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
            {clearing ? "Vaciando…" : "Vaciar Mi Bolsa"}
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
