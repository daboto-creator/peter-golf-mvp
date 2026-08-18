import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CheckoutForm } from "@/components/cart/checkout-form";
import { PublicFooter } from "@/components/catalog/public-footer";
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
    <div className="bg-pg-warm-white min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <header className="mb-10 max-w-3xl">
          <Link
            href="/carrito"
            className="focus-visible:ring-pg-gold inline-flex min-h-11 items-center rounded-lg text-sm font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            ← Volver a Mi Bolsa
          </Link>
          <p className="text-pg-gold mt-5 text-xs font-semibold tracking-[0.18em] uppercase">
            Paso final
          </p>
          <h1 className="font-heading text-pg-black mt-3 text-4xl font-bold tracking-[-0.035em] sm:text-5xl">
            Confirma tu pedido
          </h1>
          <p className="text-muted-foreground mt-4 leading-7">
            Genera un pedido pendiente de revisión. No realizaremos ningún
            cargo.
          </p>
          <ol className="text-muted-foreground mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold tracking-wide uppercase">
            <li className="text-pg-black">1 · Envío</li>
            <li>2 · Pago</li>
            <li>3 · Revisión</li>
          </ol>
        </header>
        {!cart || !context ? (
          <p
            role="alert"
            className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border p-5"
          >
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
            stripeCheckoutMode={serverEnv.STRIPE_CHECKOUT_MODE}
          />
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
