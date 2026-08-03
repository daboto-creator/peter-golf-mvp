import { formatMoneyMinorUnits } from "@/lib/catalog/presentation";
import type { CustomerOrderDetail as Order } from "@/lib/orders/customer-orders";
import { paymentLabel, statusLabel } from "@/lib/orders/presentation";

export function CustomerOrderDetail({ order }: { order: Order }) {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium tracking-wide text-emerald-800 uppercase">
          {statusLabel(order.status)}
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{order.orderNumber}</h1>
        <p className="text-muted-foreground mt-2">
          {paymentLabel(order.paymentStatus)} · {date(order.createdAt)}
        </p>
      </header>
      <section className="overflow-hidden rounded-xl border bg-white">
        <div className="border-b p-5">
          <h2 className="text-xl font-semibold">Partidas</h2>
        </div>
        <ul className="divide-y">
          {order.items.map((item, index) => (
            <li
              key={`${item.sku}-${index}`}
              className="grid gap-2 p-5 sm:grid-cols-[1fr_auto]"
            >
              <div>
                <p className="font-medium">
                  {item.productName}
                  {item.variantName ? ` · ${item.variantName}` : ""}
                </p>
                <p className="text-muted-foreground text-sm">
                  SKU {item.sku} · {item.quantity} ×{" "}
                  {formatMoneyMinorUnits(item.unitPrice, order.currency)}
                </p>
              </div>
              <strong>
                {formatMoneyMinorUnits(item.lineTotal, order.currency)}
              </strong>
            </li>
          ))}
        </ul>
        <div className="ml-auto grid max-w-md grid-cols-2 gap-2 border-t p-5 text-sm">
          <span>Subtotal</span>
          <strong className="text-right">
            {formatMoneyMinorUnits(order.subtotal, order.currency)}
          </strong>
          <span>Envío</span>
          <strong className="text-right">
            {formatMoneyMinorUnits(order.shippingTotal, order.currency)}
          </strong>
          <span>Descuento</span>
          <strong className="text-right">
            {formatMoneyMinorUnits(order.discountTotal, order.currency)}
          </strong>
          <span>Impuestos</span>
          <strong className="text-right">
            {formatMoneyMinorUnits(order.taxTotal, order.currency)}
          </strong>
          <span className="text-lg">Total</span>
          <strong className="text-right text-lg">
            {formatMoneyMinorUnits(order.total, order.currency)}
          </strong>
        </div>
      </section>
      <section className="grid gap-5 md:grid-cols-2">
        <Box title="Dirección de envío">
          <p>
            {order.address.recipientName} · {order.address.phone}
          </p>
          <p>
            {order.address.street} {order.address.exteriorNumber}
            {order.address.interiorNumber
              ? ` int. ${order.address.interiorNumber}`
              : ""}
          </p>
          <p>
            {order.address.neighborhood}, {order.address.city},{" "}
            {order.address.state}, C.P. {order.address.postalCode}
          </p>
          {order.address.references ? (
            <p className="text-muted-foreground mt-2">
              {order.address.references}
            </p>
          ) : null}
        </Box>
        <Box title="Historial">
          {order.history.map((entry) => (
            <p
              key={`${entry.createdAt}-${entry.fromStatus ?? "initial"}-${entry.toStatus}`}
            >
              {statusLabel(entry.toStatus)} · {date(entry.createdAt)}
            </p>
          ))}
        </Box>
      </section>
    </div>
  );
}
function Box({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-xl border bg-white p-5">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="space-y-1 text-sm">{children}</div>
    </div>
  );
}
function date(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
