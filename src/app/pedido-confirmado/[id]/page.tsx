import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { PublicHeader } from "@/components/catalog/public-header";
import { PublicFooter } from "@/components/catalog/public-footer";
import { CustomerOrderDetail } from "@/components/orders/customer-order-detail";
import { Button } from "@/components/ui/button";
import { requireAuthenticatedUser } from "@/lib/auth/user";
import { getCustomerOrder } from "@/lib/orders/customer-orders";
import { serverEnv } from "@/env/server";

export const metadata: Metadata = { title: "Pedido recibido | Peter Golf" };
export const dynamic = "force-dynamic";

export default async function ConfirmedOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAuthenticatedUser(`/pedido-confirmado/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const order = await getCustomerOrder(id);
  if (!order) notFound();
  return (
    <div className="bg-pg-warm-white min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <section className="border-pg-success/25 bg-pg-success/5 text-pg-charcoal mb-10 rounded-[20px] border p-6 sm:p-8">
          <p className="text-pg-success text-xs font-semibold tracking-[0.18em] uppercase">
            Pedido recibido
          </p>
          <h1 className="font-heading text-pg-black mt-3 text-3xl font-bold sm:text-4xl">
            Recibimos tu pedido
          </h1>
          <p className="mt-3 max-w-3xl leading-7">
            Está pendiente de revisión operativa. No se realizó ningún cargo. Si
            elegiste tarjeta, el pago se habilitará aquí después de que
            Operaciones confirme el pedido.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/cuenta/pedidos">Ir a mis pedidos</Link>
          </Button>
        </section>
        <CustomerOrderDetail
          order={order}
          paymentControls={{
            mode: serverEnv.PAYMENTS_MODE,
            idempotencyKey: randomUUID(),
            stripeMode: serverEnv.STRIPE_CHECKOUT_MODE,
            stripeIdempotencyKey: randomUUID(),
          }}
        />
      </main>
      <PublicFooter />
    </div>
  );
}
