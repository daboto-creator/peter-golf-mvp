import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { PublicHeader } from "@/components/catalog/public-header";
import { Button } from "@/components/ui/button";
import { requireAuthenticatedUser } from "@/lib/auth/user";

export const metadata: Metadata = {
  title: "Checkout cancelado | Best Round Pro Shop",
};

export default async function StripeCanceledPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const orderId = z.uuid().safeParse(query.pedido);
  await requireAuthenticatedUser(
    orderId.success
      ? `/pagos/stripe/cancelado?pedido=${orderId.data}`
      : "/cuenta/pedidos",
  );
  return (
    <div className="bg-muted/30 min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <section className="rounded-xl border bg-white p-6 sm:p-8">
          <h1 className="text-3xl font-semibold">No completaste el Checkout</h1>
          <p className="text-muted-foreground mt-3">
            Volver desde Stripe no cancela el pedido, no cambia el pago y no
            devuelve inventario. Puedes regresar al pedido e intentarlo de nuevo
            mientras siga disponible.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {orderId.success ? (
              <Button asChild>
                <Link href={`/cuenta/pedidos/${orderId.data}`}>
                  Volver al pedido
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href="/cuenta/pedidos">Ir a mis pedidos</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
