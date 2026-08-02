import type { Database } from "@/types/database.types";

export function statusLabel(
  status: Database["public"]["Enums"]["order_status"],
) {
  if (status === "pending_confirmation") return "Preliminar";
  if (status === "preparing") return "Confirmado";
  if (status === "cancelled") return "Cancelado";
  return status.replaceAll("_", " ");
}
export function channelLabel(
  channel: Database["public"]["Enums"]["manual_order_channel"],
) {
  return {
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    phone: "Teléfono",
    in_person: "Venta presencial",
    bank_transfer: "Transferencia",
    other: "Otro",
  }[channel];
}
export function paymentLabel(
  status: Database["public"]["Enums"]["manual_payment_status"],
) {
  return {
    pending: "Pago pendiente",
    transfer_pending: "Transferencia pendiente",
    transfer_verified: "Transferencia verificada",
    cash_received: "Efectivo",
    external_terminal_received: "Terminal externa",
  }[status];
}
