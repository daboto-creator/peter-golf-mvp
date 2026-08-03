"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialCartActionResult } from "@/lib/cart/cart-action-state";
import { addToCartAction } from "@/lib/cart/cart-actions";

export function AddToCartForm({
  productId,
  slug,
  variants,
  idempotencyKey,
}: {
  productId: string;
  slug: string;
  variants: { id: string; name: string; sku: string }[];
  idempotencyKey: string;
}) {
  const [state, action, pending] = useActionState(
    addToCartAction,
    initialCartActionResult,
  );
  if (!variants.length) {
    return (
      <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
        Este producto no tiene variantes disponibles.
      </p>
    );
  }
  return (
    <form
      action={action}
      className="mt-8 space-y-4 rounded-xl border bg-zinc-50 p-5"
    >
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <label className="block space-y-2 text-sm font-medium">
        <span>Variante</span>
        <select
          name="variantId"
          required
          className="border-input h-11 w-full rounded-md border bg-white px-3"
        >
          {variants.map((variant) => (
            <option key={variant.id} value={variant.id}>
              {variant.name} · SKU {variant.sku}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-2 text-sm font-medium">
        <span>Cantidad</span>
        <Input
          name="quantity"
          type="number"
          inputMode="numeric"
          min={1}
          max={99}
          defaultValue={1}
          required
        />
      </label>
      {state.message ? (
        <p
          role="status"
          className={
            state.status === "success"
              ? "text-sm text-emerald-800"
              : "text-sm text-red-700"
          }
        >
          {state.message}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Agregando…" : "Agregar al carrito"}
        </Button>
        {state.status === "success" ? (
          <Button asChild variant="outline" size="lg">
            <Link href="/carrito">Ir al carrito</Link>
          </Button>
        ) : null}
      </div>
      <p className="text-muted-foreground text-xs">
        Necesitas iniciar sesión para guardar el carrito. La disponibilidad se
        valida nuevamente en checkout.
      </p>
    </form>
  );
}
