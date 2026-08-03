import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CheckoutForm } from "@/components/cart/checkout-form";
import { PublicHeader } from "@/components/catalog/public-header";
import { Button } from "@/components/ui/button";
import { serverEnv } from "@/env/server";
import { requireAuthenticatedUser } from "@/lib/auth/user";
import {
  getCustomerCart,
  getCustomerCheckoutContext,
} from "@/lib/cart/customer-cart";

export const metadata: Metadata = { title: "Checkout | Peter Golf" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  await requireAuthenticatedUser("/checkout");
  const [cart, context] = await Promise.all([
    getCustomerCart(),
    getCustomerCheckoutContext(),
  ]);
  if (cart && (!cart.cart_id || !cart.version || !cart.items.length))
    redirect("/carrito");
  return (
    <div className="bg-muted/30 min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <Link
            href="/carrito"
            className="text-sm font-medium text-emerald-800 hover:underline"
          >
            ← Volver al carrito
          </Link>
          <h1 className="mt-3 text-3xl font-semibold">Checkout</h1>
          <p className="text-muted-foreground mt-2">
            Genera un pedido pendiente de revisión. No realizaremos ningún
            cargo.
          </p>
        </header>
        {!cart || !context ? (
          <p className="rounded-xl bg-red-50 p-5 text-red-800">
            No pudimos preparar el checkout.
          </p>
        ) : cart.has_issues ? (
          <section className="rounded-xl bg-amber-50 p-6 text-amber-950">
            <h2 className="font-semibold">El carrito requiere revisión</h2>
            <p className="mt-2 text-sm">
              Cambió un precio o la disponibilidad. Actualiza las partidas antes
              de continuar.
            </p>
            <Button asChild className="mt-4">
              <Link href="/carrito">Revisar carrito</Link>
            </Button>
          </section>
        ) : !context.shippingMethod ? (
          <p className="rounded-xl bg-amber-50 p-5 text-amber-950">
            El método de envío temporal no está disponible.
          </p>
        ) : (
          <CheckoutForm
            cart={cart as typeof cart & { cart_id: string; version: number }}
            addresses={context.addresses}
            shippingMethod={context.shippingMethod}
            idempotencyKey={randomUUID()}
            paymentsMode={serverEnv.PAYMENTS_MODE}
          />
        )}
      </main>
    </div>
  );
}
