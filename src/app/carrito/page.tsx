import { randomUUID } from "node:crypto";
import type { Metadata } from "next";

import { CartView } from "@/components/cart/cart-view";
import { PublicHeader } from "@/components/catalog/public-header";
import { requireAuthenticatedUser } from "@/lib/auth/user";
import { getCustomerCart } from "@/lib/cart/customer-cart";

export const metadata: Metadata = { title: "Carrito | Peter Golf" };
export const dynamic = "force-dynamic";

export default async function CartPage() {
  await requireAuthenticatedUser("/carrito");
  const cart = await getCustomerCart();
  return (
    <div className="bg-muted/30 min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <p className="text-sm font-medium tracking-wide text-emerald-800 uppercase">
            Compra sin cobro en línea
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Carrito</h1>
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
          <p className="rounded-xl bg-red-50 p-5 text-red-800">
            No pudimos cargar tu carrito. Inténtalo nuevamente.
          </p>
        )}
      </main>
    </div>
  );
}
