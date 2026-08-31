import { formatMoneyMinorUnits } from "@/lib/catalog/presentation";
import type { CustomerOrderDetail as Order } from "@/lib/orders/customer-orders";
import { CustomerBankTransferForm } from "@/components/payments/customer-bank-transfer-form";
import { CustomerStripeCheckoutButton } from "@/components/payments/customer-stripe-checkout-button";
import { StripePaymentStatus } from "@/components/payments/stripe-payment-status";
import { statusLabel } from "@/lib/orders/presentation";
import {
  canStartStripeCheckout,
  resolveEffectiveStripeCheckoutStatus,
} from "@/lib/orders/order-transform";
import {
  paymentMethodLabel,
  paymentProviderLabel,
  paymentStatusLabel,
} from "@/lib/payments/payment-rules";
import {
  BuyerAcceptanceForm,
  ClaimEvidenceForm,
} from "@/components/marketplace/claim-action-form";
import type { PartnerActionState } from "@/lib/marketplace/partner-action-state";
import { fulfillmentStatusLabel } from "@/lib/marketplace/presentation";

function customerClaimStatus(status: string) {
  if (status === "RESOLVED") return "Resuelto";
  if (status === "CANCELLED") return "Cerrado";
  return "En revisión";
}

export function CustomerOrderDetail({
  order,
  fulfillmentSummary = [],
  paymentControls,
  claimControls,
}: {
  order: Order;
  fulfillmentSummary?: {
    fulfillment_id: string;
    item_count: number;
    source: "BEST_ROUND" | "PARTNER";
    status: keyof typeof fulfillmentStatusLabel;
    carrier: string | null;
    tracking_number: string | null;
    shipped_at: string | null;
  }[];
  paymentControls?: {
    mode: "disabled" | "test";
    idempotencyKey: string;
    stripeMode: "disabled" | "test";
    stripeIdempotencyKey: string;
  };
  claimControls?: {
    items: {
      fulfillmentId: string;
      orderItemId: string;
      listingTitle: string;
      acceptanceStatus: string | null;
      acceptanceDeadline: string | null;
      claimStatus: string | null;
      claimId: string | null;
      idempotencyKey: string;
    }[];
    acceptAction: (
      state: PartnerActionState,
      data: FormData,
    ) => Promise<PartnerActionState>;
    claimAction: (
      state: PartnerActionState,
      data: FormData,
    ) => Promise<PartnerActionState>;
    evidenceAction: (
      state: PartnerActionState,
      data: FormData,
    ) => Promise<PartnerActionState>;
  };
}) {
  const effectiveStripeStatus = resolveEffectiveStripeCheckoutStatus(
    order.stripeCheckoutStatus,
    order.stripeCheckoutExpiresAt,
  );
  return (
    <div className="space-y-6">
      <header>
        <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
          {statusLabel(order.status)}
        </p>
        <h1 className="font-heading text-pg-black mt-3 text-4xl font-bold tracking-[-0.035em]">
          {order.orderNumber}
        </h1>
        <p className="text-muted-foreground mt-2">
          {paymentStatusLabel(order.paymentStatus)} · {date(order.createdAt)}
        </p>
      </header>
      <section className="overflow-hidden rounded-[20px] border bg-white">
        <div className="border-b p-5">
          <h2 className="font-heading text-2xl font-bold">Productos</h2>
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
      {fulfillmentSummary.length ? (
        <section className="space-y-4 rounded-[20px] border bg-white p-5 sm:p-6">
          <div>
            <h2 className="font-heading text-2xl font-bold">Entregas</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Tu compra sigue siendo una sola orden Best Round, aunque algunos
              artículos puedan llegar por separado.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {fulfillmentSummary.map((fulfillment, index) => (
              <li
                key={fulfillment.fulfillment_id}
                className="rounded-xl border p-4"
              >
                <p className="font-semibold">Envío {index + 1}</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {fulfillment.item_count}{" "}
                  {fulfillment.item_count === 1 ? "artículo" : "artículos"}
                  {" · "}
                  {fulfillmentStatusLabel[fulfillment.status]}
                </p>
                {fulfillment.tracking_number ? (
                  <dl className="mt-3 space-y-1 text-sm">
                    <div>
                      <dt className="inline font-medium">Transportista: </dt>
                      <dd className="inline">{fulfillment.carrier}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium">Tracking: </dt>
                      <dd className="inline">{fulfillment.tracking_number}</dd>
                    </div>
                    {fulfillment.shipped_at ? (
                      <div>
                        <dt className="inline font-medium">
                          Entregado al transportista:{" "}
                        </dt>
                        <dd className="inline">
                          {date(fulfillment.shipped_at)}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {claimControls?.items.length ? (
        <section className="space-y-5 rounded-[20px] border bg-white p-5 sm:p-6">
          <div>
            <h2 className="font-heading text-2xl font-bold">
              Entrega Marketplace
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Best Round media cualquier problema; nunca necesitas contactar al
              Partner.
            </p>
          </div>
          {claimControls.items.map((item) => (
            <div key={item.orderItemId} className="space-y-3 border-t pt-4">
              <p className="font-medium">{item.listingTitle}</p>
              {item.acceptanceStatus === "PENDING" ? (
                <p className="text-sm font-medium">Tu pedido fue entregado</p>
              ) : null}
              {item.acceptanceStatus === "PENDING" && !item.claimStatus ? (
                <BuyerAcceptanceForm
                  acceptAction={claimControls.acceptAction}
                  claimAction={claimControls.claimAction}
                  fulfillmentId={item.fulfillmentId}
                  orderItemId={item.orderItemId}
                  idempotencyKey={item.idempotencyKey}
                />
              ) : item.claimStatus &&
                item.claimStatus !== "RESOLVED" &&
                item.claimStatus !== "CANCELLED" ? (
                <>
                  <p className="text-sm">
                    Estado: {customerClaimStatus(item.claimStatus)}
                  </p>
                  {item.claimId ? (
                    <ClaimEvidenceForm
                      action={claimControls.evidenceAction}
                      claimId={item.claimId}
                      idempotencyKey={item.idempotencyKey}
                    />
                  ) : null}
                </>
              ) : (
                <p className="text-sm">
                  Estado:{" "}
                  {item.claimStatus
                    ? customerClaimStatus(item.claimStatus)
                    : item.acceptanceStatus}
                </p>
              )}
            </div>
          ))}
        </section>
      ) : null}
      <section className="space-y-3 rounded-[20px] border bg-white p-5 sm:p-6">
        <h2 className="font-heading text-2xl font-bold">Pago</h2>
        <p className="text-sm">
          {paymentMethodLabel(order.paymentMethod)} ·{" "}
          {paymentProviderLabel(order.paymentProvider)}
        </p>
        {order.paymentRefundedAmount > 0 ? (
          <p className="text-sm">
            Importe reembolsado:{" "}
            {formatMoneyMinorUnits(
              order.paymentRefundedAmount,
              order.paymentCurrency,
            )}
          </p>
        ) : null}
        {order.paymentProvider === "stripe" ? (
          <StripePaymentStatus
            orderStatus={order.status}
            paymentStatus={order.paymentStatus}
            stripeStatus={effectiveStripeStatus}
            stripeExpiresAt={order.stripeCheckoutExpiresAt}
          />
        ) : null}
      </section>
      {paymentControls ? (
        order.paymentProvider === "manual" ? (
          <CustomerBankTransferForm
            order={order}
            paymentsMode={paymentControls.mode}
            idempotencyKey={paymentControls.idempotencyKey}
          />
        ) : (
          <section className="rounded-[20px] border bg-white p-5 sm:p-6">
            <CustomerStripeCheckoutButton
              orderId={order.id}
              idempotencyKey={paymentControls.stripeIdempotencyKey}
              enabled={canStartStripeCheckout({
                paymentsMode: paymentControls.mode,
                stripeMode: paymentControls.stripeMode,
                orderStatus: order.status,
                paymentStatus: order.paymentStatus,
                stripeStatus: effectiveStripeStatus,
                stripeExpiresAt: order.stripeCheckoutExpiresAt,
              })}
            />
          </section>
        )
      ) : null}
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
    <div className="space-y-2 rounded-[20px] border bg-white p-5 sm:p-6">
      <h2 className="font-heading text-2xl font-bold">{title}</h2>
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
