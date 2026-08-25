"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMarketplacePayablesManager } from "@/lib/auth/marketplace-authorization";
import type { PartnerActionState } from "@/lib/marketplace/partner-action-state";

const baseSchema = z.object({
  payableId: z.uuid(),
  reason: z.string().trim().min(3).max(1000),
  idempotencyKey: z.uuid(),
});

function failure(): PartnerActionState {
  return {
    status: "error",
    message:
      "No pudimos aplicar la acción financiera. Recarga e inténtalo nuevamente.",
  };
}

function refresh(payableId: string) {
  revalidatePath("/operacion/marketplace/pagos");
  revalidatePath(`/operacion/marketplace/pagos/${payableId}`);
}

export async function placePayableHoldAction(
  _state: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const parsed = baseSchema
    .extend({
      source: z.enum(["OPERATIONS", "RISK", "RECONCILIATION"]),
      partnerVisible: z.enum(["true", "false"]),
    })
    .safeParse({
      payableId: formData.get("payableId"),
      reason: formData.get("reason"),
      idempotencyKey: formData.get("idempotencyKey"),
      source: formData.get("source"),
      partnerVisible: formData.get("partnerVisible"),
    });
  if (!parsed.success) return failure();
  const { client } = await requireMarketplacePayablesManager(
    `/operacion/marketplace/pagos/${parsed.data.payableId}`,
  );
  const { error } = await client.rpc("place_marketplace_partner_payable_hold", {
    requested_payable_id: parsed.data.payableId,
    requested_source: parsed.data.source,
    requested_reason: parsed.data.reason,
    requested_partner_visible: parsed.data.partnerVisible === "true",
    requested_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) return failure();
  refresh(parsed.data.payableId);
  return { status: "success", message: "Hold registrado." };
}

export async function releasePayableHoldAction(
  _state: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const parsed = baseSchema
    .omit({ payableId: true })
    .extend({ holdId: z.uuid(), payableId: z.uuid() })
    .safeParse({
      holdId: formData.get("holdId"),
      payableId: formData.get("payableId"),
      reason: formData.get("reason"),
      idempotencyKey: formData.get("idempotencyKey"),
    });
  if (!parsed.success) return failure();
  const { client } = await requireMarketplacePayablesManager(
    `/operacion/marketplace/pagos/${parsed.data.payableId}`,
  );
  const { error } = await client.rpc(
    "release_marketplace_partner_payable_hold",
    {
      requested_hold_id: parsed.data.holdId,
      requested_reason: parsed.data.reason,
      requested_idempotency_key: parsed.data.idempotencyKey,
    },
  );
  if (error) return failure();
  refresh(parsed.data.payableId);
  return { status: "success", message: "Hold liberado." };
}

export async function releasePayableAction(
  _state: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const parsed = baseSchema.safeParse({
    payableId: formData.get("payableId"),
    reason: formData.get("reason"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) return failure();
  const { client } = await requireMarketplacePayablesManager(
    `/operacion/marketplace/pagos/${parsed.data.payableId}`,
  );
  const { error } = await client.rpc("release_marketplace_partner_payable", {
    requested_payable_id: parsed.data.payableId,
    requested_basis: "OPERATIONS_APPROVED",
    requested_reason: parsed.data.reason,
    requested_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) return failure();
  refresh(parsed.data.payableId);
  return { status: "success", message: "Saldo liberado para próximo pago." };
}

export async function reversePayableAction(
  _state: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const parsed = baseSchema
    .extend({ amountCents: z.coerce.number().int().positive().safe() })
    .safeParse({
      payableId: formData.get("payableId"),
      reason: formData.get("reason"),
      idempotencyKey: formData.get("idempotencyKey"),
      amountCents: formData.get("amountCents"),
    });
  if (!parsed.success) return failure();
  const { client } = await requireMarketplacePayablesManager(
    `/operacion/marketplace/pagos/${parsed.data.payableId}`,
  );
  const { error } = await client.rpc("reverse_marketplace_partner_payable", {
    requested_payable_id: parsed.data.payableId,
    requested_amount_cents: parsed.data.amountCents,
    requested_reason: parsed.data.reason,
    requested_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) return failure();
  refresh(parsed.data.payableId);
  return { status: "success", message: "Reversión compensatoria registrada." };
}
