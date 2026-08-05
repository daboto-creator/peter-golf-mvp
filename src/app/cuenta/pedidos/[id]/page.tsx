import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { CustomerOrderDetail } from "@/components/orders/customer-order-detail";
import { getCustomerOrder } from "@/lib/orders/customer-orders";
import { serverEnv } from "@/env/server";

export const metadata: Metadata = { title: "Detalle de pedido | Peter Golf" };

export default async function CustomerOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const order = await getCustomerOrder(id);
  if (!order) notFound();
  return (
    <div className="space-y-5">
      <Link
        href="/cuenta/pedidos"
        className="text-sm font-medium text-emerald-800 hover:underline"
      >
        ← Volver a mis pedidos
      </Link>
      <CustomerOrderDetail
        order={order}
        paymentControls={{
          mode: serverEnv.PAYMENTS_MODE,
          idempotencyKey: randomUUID(),
          stripeMode: serverEnv.STRIPE_CHECKOUT_MODE,
          stripeIdempotencyKey: randomUUID(),
        }}
      />
    </div>
  );
}
