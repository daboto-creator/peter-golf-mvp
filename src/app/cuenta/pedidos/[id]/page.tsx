import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { CustomerOrderDetail } from "@/components/orders/customer-order-detail";
import { getCustomerOrder } from "@/lib/orders/customer-orders";
import { serverEnv } from "@/env/server";
import {
  acceptDeliveryAction,
  openClaimAction,
  uploadClaimEvidenceAction,
} from "@/lib/marketplace/claim-actions";
import { getCustomerClaimContext } from "@/lib/marketplace/claim-data";

export const metadata: Metadata = {
  title: "Detalle de pedido | Best Round Pro Shop",
};

export default async function CustomerOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const order = await getCustomerOrder(id);
  if (!order) notFound();
  const claimContext = await getCustomerClaimContext(id);
  return (
    <div className="space-y-5">
      <Link
        href="/cuenta/pedidos"
        className="focus-visible:ring-pg-gold inline-flex min-h-11 items-center rounded-lg text-sm font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
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
        claimControls={{
          items: claimContext.data.map((item) => ({
            fulfillmentId: item.fulfillment_id,
            orderItemId: item.order_item_id,
            listingTitle: item.listing_title,
            acceptanceStatus: item.acceptance_status,
            acceptanceDeadline: item.acceptance_deadline,
            claimStatus: item.claim_status,
            claimId: item.claim_id,
            idempotencyKey: randomUUID(),
          })),
          acceptAction: acceptDeliveryAction,
          claimAction: openClaimAction,
          evidenceAction: uploadClaimEvidenceAction,
        }}
      />
    </div>
  );
}
