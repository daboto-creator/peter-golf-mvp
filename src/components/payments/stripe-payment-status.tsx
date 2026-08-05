import type { Database } from "@/types/database.types";

type Props = {
  orderStatus: Database["public"]["Enums"]["order_status"];
  paymentStatus: Database["public"]["Enums"]["payment_status"];
  stripeStatus: Database["public"]["Enums"]["stripe_checkout_status"] | null;
};

export function StripePaymentStatus(props: Props) {
  const state = resolveState(props);
  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-lg p-4 text-sm ${state.className}`}
    >
      <p className="font-semibold">{state.title}</p>
      <p className="mt-1">{state.description}</p>
    </div>
  );
}

function resolveState({ orderStatus, paymentStatus, stripeStatus }: Props) {
  if (paymentStatus === "refunded" || paymentStatus === "partially_refunded") {
    return {
      title: "Reembolsado",
      description:
        paymentStatus === "refunded"
          ? "Stripe reportó el reembolso total del pago."
          : "Stripe reportó un reembolso parcial del pago.",
      className: "bg-violet-50 text-violet-950",
    };
  }
  if (paymentStatus === "paid") {
    return {
      title: "Pagado",
      description: "El webhook firmado de Stripe confirmó el pago.",
      className: "bg-emerald-50 text-emerald-950",
    };
  }
  if (stripeStatus === "creating") {
    return {
      title: "Preparando sesión",
      description: "Estamos creando tu sesión segura de Stripe Checkout.",
      className: "bg-blue-50 text-blue-950",
    };
  }
  if (stripeStatus === "open") {
    return {
      title: "Confirmando pago",
      description:
        "La sesión está abierta. El estado cambiará sólo cuando llegue el webhook de Stripe.",
      className: "bg-blue-50 text-blue-950",
    };
  }
  if (stripeStatus === "payment_failed" || paymentStatus === "failed") {
    return {
      title: "Intento fallido",
      description: "Puedes iniciar un nuevo intento con una tarjeta de prueba.",
      className: "bg-red-50 text-red-950",
    };
  }
  if (stripeStatus === "expired") {
    return {
      title: "Sesión expirada",
      description:
        "El pedido sigue preparando y el inventario no cambió. Puedes intentarlo de nuevo.",
      className: "bg-amber-50 text-amber-950",
    };
  }
  if (orderStatus === "pending_confirmation") {
    return {
      title: "Pendiente de confirmación",
      description:
        "Operaciones debe confirmar el pedido antes de habilitar el pago.",
      className: "bg-amber-50 text-amber-950",
    };
  }
  if (orderStatus === "cancelled" || orderStatus === "returned") {
    return {
      title: "Pedido sin pago disponible",
      description: "Este pedido ya no admite nuevos intentos de pago.",
      className: "bg-slate-100 text-slate-900",
    };
  }
  return {
    title: "Listo para pagar",
    description: "El pedido fue confirmado y ya puedes abrir Stripe Checkout.",
    className: "bg-emerald-50 text-emerald-950",
  };
}
