import { z } from "zod";

import type { Database } from "@/types/database.types";

export const paymentStatuses = [
  "pending",
  "submitted",
  "under_review",
  "paid",
  "rejected",
  "refunded",
] as const;

export type PaymentStatus = (typeof paymentStatuses)[number];

export const paymentTransitions: Readonly<
  Record<PaymentStatus, readonly PaymentStatus[]>
> = {
  pending: ["submitted"],
  submitted: ["under_review", "rejected"],
  under_review: ["paid", "rejected"],
  paid: ["refunded"],
  rejected: ["submitted"],
  refunded: [],
};

const optionalText = z
  .string()
  .trim()
  .max(120)
  .transform((value) => value || null);

const transferFormSchema = z.object({
  transferReference: z.string().trim().min(3).max(120),
  transferDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => !Number.isNaN(Date.parse(`${value}T12:00:00.000Z`))),
  senderName: optionalText.refine(
    (value) => value === null || value.length >= 2,
  ),
  senderBank: optionalText.refine(
    (value) => value === null || value.length >= 2,
  ),
});

export type BankTransferSubmission = {
  transferReference: string;
  transferredAt: string;
  senderName: string | null;
  senderBank: string | null;
};

export function parseBankTransferForm(
  formData: FormData,
):
  | { success: true; data: BankTransferSubmission }
  | { success: false; message: string } {
  const result = transferFormSchema.safeParse({
    transferReference: formData.get("transferReference"),
    transferDate: formData.get("transferDate"),
    senderName: formData.get("senderName"),
    senderBank: formData.get("senderBank"),
  });
  if (!result.success) {
    return {
      success: false,
      message: "Revisa la referencia, fecha, remitente y banco emisor.",
    };
  }
  return {
    success: true,
    data: {
      transferReference: result.data.transferReference,
      transferredAt: `${result.data.transferDate}T12:00:00.000Z`,
      senderName: result.data.senderName,
      senderBank: result.data.senderBank,
    },
  };
}

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus) {
  return paymentTransitions[from].includes(to);
}

export function paymentStatusLabel(
  status: Database["public"]["Enums"]["payment_status"],
) {
  return {
    pending: "Pendiente de registro",
    submitted: "Transferencia registrada",
    under_review: "En revisión",
    paid: "Pago aprobado",
    rejected: "Transferencia rechazada",
    refunded: "Pago reembolsado",
  }[status];
}

export function paymentMethodLabel(
  method: Database["public"]["Enums"]["payment_method"],
) {
  return {
    bank_transfer: "Transferencia bancaria",
    cash: "Efectivo",
    external_terminal: "Terminal externa",
  }[method];
}
