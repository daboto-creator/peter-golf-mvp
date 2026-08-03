import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { PublicHeader } from "@/components/catalog/public-header";
import { CustomerOrderDetail } from "@/components/orders/customer-order-detail";
import { Button } from "@/components/ui/button";
import { requireAuthenticatedUser } from "@/lib/auth/user";
import { getCustomerOrder } from "@/lib/orders/customer-orders";

export const metadata: Metadata = { title: "Pedido confirmado | Peter Golf" };
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
    <div className="bg-muted/30 min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <section className="mb-8 rounded-xl bg-emerald-50 p-6 text-emerald-950">
          <h1 className="text-2xl font-semibold">Recibimos tu pedido</h1>
          <p className="mt-2">
            Está pendiente de revisión. Peter Golf confirmará disponibilidad,
            transferencia y próximos pasos; todavía no se realizó ningún cargo.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/cuenta/pedidos">Ir a mis pedidos</Link>
          </Button>
        </section>
        <CustomerOrderDetail order={order} />
      </main>
    </div>
  );
}
