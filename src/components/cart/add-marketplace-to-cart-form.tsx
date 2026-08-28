"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialCartActionResult } from "@/lib/cart/cart-action-state";
import { addMarketplaceToCartAction } from "@/lib/cart/cart-actions";

export function AddMarketplaceToCartForm({
  listingId,
  pricingQuoteId,
  slug,
  availableQuantity,
  idempotencyKey,
}: {
  listingId: string;
  pricingQuoteId: string;
  slug: string;
  availableQuantity: number;
  idempotencyKey: string;
}) {
  const [state, action, pending] = useActionState(
    addMarketplaceToCartAction,
    initialCartActionResult,
  );
  return (
    <form
      action={action}
      className="bg-pg-warm-white border-border mt-8 space-y-5 rounded-[20px] border p-5 sm:p-6"
    >
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="pricingQuoteId" value={pricingQuoteId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <label className="block space-y-2 text-sm font-medium">
        <span>Cantidad</span>
        <Input
          name="quantity"
          type="number"
          inputMode="numeric"
          min={1}
          max={Math.min(99, availableQuantity)}
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
        <Button
          type="submit"
          size="lg"
          disabled={pending || availableQuantity < 1}
          className="min-h-12 flex-1 rounded-xl"
        >
          {pending ? "Agregando…" : "Agregar a Mi Bolsa"}
        </Button>
        {state.status === "success" ? (
          <Button
            asChild
            variant="outline"
            size="lg"
            className="min-h-12 flex-1 rounded-xl"
          >
            <Link href="/carrito">Ir a Mi Bolsa</Link>
          </Button>
        ) : null}
      </div>
      <p className="text-muted-foreground text-xs leading-5">
        Best Round validará nuevamente precio, versión e inventario antes del
        checkout.
      </p>
    </form>
  );
}
