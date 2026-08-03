import Link from "next/link";

import { Button } from "@/components/ui/button";
import { formatMoneyMinorUnits } from "@/lib/catalog/presentation";
import {
  orderOriginLabel,
  paymentLabel,
  statusLabel,
} from "@/lib/orders/presentation";
import type { ManualOrderSummary } from "@/lib/orders/operational-orders";

export function OrderList({ orders }: { orders: ManualOrderSummary[] }) {
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-white">
      {orders.map((order) => (
        <li
          key={order.id}
          className="grid gap-4 p-5 lg:grid-cols-[1fr_1.5fr_1fr_1fr_auto] lg:items-center"
        >
          <div>
            <p className="font-semibold">{order.orderNumber}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {new Intl.DateTimeFormat("es-MX", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(order.createdAt))}
            </p>
          </div>
          <div>
            <p className="font-medium">{order.customerName}</p>
            <p className="text-muted-foreground text-sm">
              {order.customerPhone}
              {order.customerEmail ? ` · ${order.customerEmail}` : ""}
            </p>
          </div>
          <div className="text-sm">
            <p>{orderOriginLabel(order.origin, order.channel)}</p>
            <p className="text-muted-foreground mt-1">
              {statusLabel(order.status)} · {paymentLabel(order.paymentStatus)}
            </p>
          </div>
          <div>
            <p className="font-medium">
              {formatMoneyMinorUnits(order.total, order.currency)}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {order.itemCount} unidades · Actualizado{" "}
              {new Intl.DateTimeFormat("es-MX", { dateStyle: "short" }).format(
                new Date(order.updatedAt),
              )}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={`/operacion/pedidos/${order.id}`}>Ver pedido</Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}
