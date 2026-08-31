import type { FulfillmentStatus } from "@/lib/marketplace/fulfillment-rules";
import type { PartnerPayableStatus } from "@/lib/marketplace/partner-finance-rules";

export const fulfillmentStatusLabel: Record<FulfillmentStatus, string> = {
  PENDING_CONFIRMATION: "Confirma disponibilidad",
  CONFIRMED: "Disponibilidad confirmada",
  PREPARING: "Preparando envío",
  READY_FOR_CARRIER: "Listo para enviar",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  ACCEPTANCE_PENDING: "Confirma tu entrega",
  COMPLETED: "Completado",
  ON_HOLD: "En revisión",
  CANCELLED: "Cancelado",
};

export const listingStatusLabel = {
  DRAFT: "Borrador",
  SUBMITTED: "En revisión por Best Round",
  UNDER_REVIEW: "En revisión por Best Round",
  CHANGES_REQUESTED: "Requiere ajustes",
  APPROVED: "Aprobado",
  PUBLISHED: "Publicado",
  PAUSED: "Aprobado",
  SOLD: "Agotado",
  REJECTED: "No aprobado",
  EXPIRED: "Requiere ajustes",
  ARCHIVED: "Archivado",
} as const;

export function partnerListingStatusLabel(input: {
  listingStatus: keyof typeof listingStatusLabel;
  published?: boolean;
  inventoryAvailable?: number | null;
}) {
  if (input.inventoryAvailable === 0) return "Agotado";
  if (input.published) return "Publicado";
  return listingStatusLabel[input.listingStatus];
}

export const pricingViabilityLabel = {
  COMPETITIVE: "Precio dentro del mercado observado",
  SLIGHTLY_HIGH: "Precio ligeramente arriba del mercado observado",
  UNDERPRICED: "Precio debajo del mercado observado",
  OVERPRICED: "Precio arriba del mercado observado",
  INSUFFICIENT_DATA: "Falta analizar precio de mercado",
} as const;

export const payableStatusLabel: Record<PartnerPayableStatus, string> = {
  PENDING: "Pendiente",
  ON_HOLD: "En revisión",
  AVAILABLE: "Disponible para pago",
  PAID: "Pagado",
  REVERSED: "Ajuste realizado",
};

export const onboardingStages = [
  { key: "datos", label: "Datos" },
  { key: "identidad", label: "Identidad" },
  { key: "documentos", label: "Documentos" },
  { key: "listo", label: "Listo" },
] as const;
