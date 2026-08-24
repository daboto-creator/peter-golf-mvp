import { randomUUID } from "node:crypto";
import type { Metadata } from "next";

import { CartView } from "@/components/cart/cart-view";
import { PublicFooter } from "@/components/catalog/public-footer";
import { PublicHeader } from "@/components/catalog/public-header";
import { requireAuthenticatedUser } from "@/lib/auth/user";
import { getCustomerCart } from "@/lib/cart/customer-cart";

export const metadata: Metadata = { title: "Mi Bolsa | Best Round Pro Shop" };
export const dynamic = "force-dynamic";

export default async function CartPage() {
  await requireAuthenticatedUser("/carrito");
  const cart = await getCustomerCart();
  return (
    <div className="bg-pg-warm-white min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <header className="mb-10 max-w-3xl">
          <p className="before:bg-pg-gold flex items-center gap-3 text-xs font-semibold tracking-[0.18em] uppercase before:h-px before:w-8">
            Tu selección
          </p>
          <h1 className="font-heading text-pg-black mt-4 text-4xl font-bold tracking-[-0.035em] sm:text-5xl">
            Mi Bolsa
          </h1>
          <p className="text-muted-foreground mt-4 leading-7">
            Revisa tu equipo, cantidades y disponibilidad antes de continuar.
          </p>
        </header>
        {cart ? (
          <CartView
            cart={cart}
            keys={Object.fromEntries(
              cart.items.map((item) => [
                item.id,
                { update: randomUUID(), remove: randomUUID() },
              ]),
            )}
            clearKey={randomUUID()}
          />
        ) : (
          <p
            role="alert"
            className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border p-5"
          >
            No pudimos cargar Mi Bolsa. Inténtalo nuevamente.
          </p>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
