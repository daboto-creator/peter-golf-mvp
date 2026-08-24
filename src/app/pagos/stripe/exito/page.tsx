import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { PublicHeader } from "@/components/catalog/public-header";
import { StripePaymentStatus } from "@/components/payments/stripe-payment-status";
import { Button } from "@/components/ui/button";
import { requireAuthenticatedUser } from "@/lib/auth/user";
import { getCustomerOrder } from "@/lib/orders/customer-orders";

export const metadata: Metadata = {
  title: "Estado del pago | Best Round Pro Shop",
};
export const dynamic = "force-dynamic";

export default async function StripeSuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const parsedOrderId = z.uuid().safeParse(query.pedido);
  await requireAuthenticatedUser(
    parsedOrderId.success
      ? `/pagos/stripe/exito?pedido=${parsedOrderId.data}`
      : "/cuenta/pedidos",
  );
  const order = parsedOrderId.success
    ? await getCustomerOrder(parsedOrderId.data)
    : null;

  return (
    <div className="bg-muted/30 min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <section className="space-y-5 rounded-xl border bg-white p-6 sm:p-8">
          <div>
            <p className="text-sm font-medium text-emerald-800 uppercase">
              Regresaste de Stripe Checkout
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Estado del pago</h1>
            <p className="text-muted-foreground mt-2">
              Esta página no confirma el pago por la URL. El estado siguiente
              proviene exclusivamente del webhook firmado y la base de datos.
            </p>
          </div>
          {order?.paymentProvider === "stripe" ? (
            <StripePaymentStatus
              orderStatus={order.status}
              paymentStatus={order.paymentStatus}
              stripeStatus={order.stripeCheckoutStatus}
              stripeExpiresAt={order.stripeCheckoutExpiresAt}
            />
          ) : (
            <p
              role="alert"
              className="rounded-lg bg-amber-50 p-4 text-amber-950"
            >
              No pudimos localizar un pago Stripe propio para esta solicitud.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            {order ? (
              <Button asChild>
                <Link href={`/cuenta/pedidos/${order.id}`}>
                  Ver detalle del pedido
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
