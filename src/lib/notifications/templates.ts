import { z } from "zod";

import {
  notificationEventLabels,
  type NotificationEventType,
} from "@/lib/notifications/notification-rules";

const templateDataSchema = z.object({
  order_number: z.string().min(1).max(80),
  origin: z.enum(["manual", "web"]),
  total: z.number().nonnegative(),
  currency: z.string().length(3),
  expected_amount: z.number().nonnegative().optional(),
  payment_currency: z.string().length(3).optional(),
});

export type NotificationTemplateInput = {
  eventType: NotificationEventType;
  customerName: string;
  orderId: string;
  templateData: unknown;
  occurredAt: string;
  appUrl: string;
};

export type RenderedNotification = {
  subject: string;
  text: string;
  html: string;
};

const banner = "Mensaje de prueba. No realizar una transferencia real";

export function renderNotificationTemplate(
  input: NotificationTemplateInput,
): RenderedNotification {
  const data = templateDataSchema.parse(input.templateData);
  const label = notificationEventLabels[input.eventType];
  const greeting = `Hola ${input.customerName.trim() || "cliente"}`;
  const date = new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(new Date(input.occurredAt));
  const amount = [
    "order_created",
    "order_confirmed",
    "payment_paid",
    "payment_refunded",
    "order_cancelled",
  ].includes(input.eventType)
    ? formatMoney(
        input.eventType.startsWith("payment_")
          ? (data.expected_amount ?? data.total)
          : data.total,
        data.payment_currency ?? data.currency,
      )
    : null;
  const detail = eventDetail(input.eventType);
  const link =
    data.origin === "web"
      ? `${input.appUrl.replace(/\/$/, "")}/cuenta/pedidos/${input.orderId}`
      : null;
  const lines = [
    banner,
    "",
    `${greeting},`,
    "",
    detail,
    `Pedido: ${data.order_number}`,
    `Estado: ${label}`,
    `Fecha: ${date}`,
    ...(amount ? [`Importe: ${amount}`] : []),
    ...(link ? ["", `Consulta tu pedido: ${link}`] : []),
    "",
    "Best Round Pro Shop",
  ];
  return {
    subject: `[PRUEBA] ${label} · ${data.order_number}`,
    text: lines.join("\n"),
    html: `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#16302b">
      <p style="padding:12px;background:#fff4ce;border:1px solid #e0b84f"><strong>${escapeHtml(banner)}</strong></p>
      <p>${escapeHtml(greeting)},</p>
      <p>${escapeHtml(detail)}</p>
      <dl>
        <dt><strong>Pedido</strong></dt><dd>${escapeHtml(data.order_number)}</dd>
        <dt><strong>Estado</strong></dt><dd>${escapeHtml(label)}</dd>
        <dt><strong>Fecha</strong></dt><dd>${escapeHtml(date)}</dd>
        ${amount ? `<dt><strong>Importe</strong></dt><dd>${escapeHtml(amount)}</dd>` : ""}
      </dl>
      ${link ? `<p><a href="${escapeHtml(link)}">Consulta tu pedido</a></p>` : ""}
      <p>Best Round Pro Shop</p>
    </div>`,
  };
}

function eventDetail(eventType: NotificationEventType) {
  return {
    order_created:
      "Recibimos tu pedido de prueba y está pendiente de confirmación.",
    order_confirmed: "Tu pedido fue confirmado y está en preparación.",
    transfer_submitted: "Registramos tu transferencia simulada.",
    payment_under_review: "La transferencia simulada está en revisión.",
    payment_paid: "El pago simulado fue aprobado.",
    payment_rejected:
      "La transferencia simulada fue rechazada. Revisa tu pedido para registrar otro intento.",
    payment_refunded: "El pago simulado fue marcado como reembolsado.",
    order_cancelled: "Tu pedido fue cancelado.",
  }[eventType];
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
  }).format(amount / 100);
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    }[character] as string;
  });
}
