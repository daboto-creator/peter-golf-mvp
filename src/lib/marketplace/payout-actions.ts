"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMarketplacePayoutsManager } from "@/lib/auth/marketplace-authorization";
import type { PartnerActionState } from "@/lib/marketplace/partner-action-state";

const uuid = z.uuid();
const reason = z.string().trim().min(3).max(1000);

function fail(
  message = "No pudimos aplicar la acción de payout.",
): PartnerActionState {
  return { status: "error", message };
}

function refresh(payoutId?: string) {
  revalidatePath("/operacion/marketplace/pagos");
  revalidatePath("/operacion/marketplace/payouts");
  if (payoutId) revalidatePath(`/operacion/marketplace/payouts/${payoutId}`);
  revalidatePath("/partner/pagos");
}

export async function createPayoutAction(
  _state: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const parsed = z
    .object({
      partnerId: uuid,
      payableIds: z
        .string()
        .transform((value) => value.split(",").filter(Boolean)),
      idempotencyKey: uuid,
    })
    .safeParse({
      partnerId: formData.get("partnerId"),
      payableIds: formData.get("payableIds"),
      idempotencyKey: formData.get("idempotencyKey"),
    });
  if (
    !parsed.success ||
    !parsed.data.payableIds.length ||
    parsed.data.payableIds.some((id) => !uuid.safeParse(id).success)
  )
    return fail();
  const { client } = await requireMarketplacePayoutsManager(
    "/operacion/marketplace/payouts",
  );
  const { data, error } = await client.rpc(
    "create_marketplace_partner_payout",
    {
      requested_partner_id: parsed.data.partnerId,
      requested_payable_ids: parsed.data.payableIds,
      requested_idempotency_key: parsed.data.idempotencyKey,
    },
  );
  if (error)
    return fail(
      error.message.includes("eligible")
        ? "Uno de los saldos ya no es elegible."
        : undefined,
    );
  refresh(data.id);
  return {
    status: "success",
    message: `Payout ${data.payout_reference} creado.`,
  };
}

export async function payoutAction(
  _state: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const parsed = z
    .object({
      payoutId: uuid,
      idempotencyKey: uuid,
      mode: z.enum(["ready", "confirm", "cancel", "fail", "reconcile"]),
      reason: reason.optional(),
    })
    .safeParse({
      payoutId: formData.get("payoutId"),
      idempotencyKey: formData.get("idempotencyKey"),
      mode: formData.get("mode"),
      reason: formData.get("reason") || undefined,
    });
  if (!parsed.success) return fail();
  const { client } = await requireMarketplacePayoutsManager(
    `/operacion/marketplace/payouts/${parsed.data.payoutId}`,
  );
  const common = {
    requested_payout_id: parsed.data.payoutId,
    requested_idempotency_key: parsed.data.idempotencyKey,
  };
  const fallbackReason = "Acción de payout autorizada por Operaciones.";
  let error;
  if (parsed.data.mode === "ready")
    ({ error } = await client.rpc("mark_marketplace_partner_payout_ready", {
      ...common,
      requested_reason: parsed.data.reason ?? fallbackReason,
    }));
  else if (parsed.data.mode === "confirm")
    ({ error } = await client.rpc(
      "confirm_marketplace_payout_settlement",
      common,
    ));
  else if (parsed.data.mode === "cancel")
    ({ error } = await client.rpc("cancel_marketplace_partner_payout", {
      ...common,
      requested_reason: parsed.data.reason ?? fallbackReason,
    }));
  else if (parsed.data.mode === "fail")
    ({ error } = await client.rpc("fail_marketplace_partner_payout", {
      ...common,
      requested_reason: parsed.data.reason ?? fallbackReason,
    }));
  else
    ({ error } = await client.rpc("flag_marketplace_payout_reconciliation", {
      ...common,
      requested_reason: parsed.data.reason ?? fallbackReason,
    }));
  if (error) return fail();
  refresh(parsed.data.payoutId);
  return { status: "success", message: "Acción registrada." };
}

export async function recordManualTransferAction(
  _state: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const parsed = z
    .object({
      payoutId: uuid,
      transferDate: z.iso.date(),
      bankLabel: z.string().trim().min(2).max(120),
      externalReference: z.string().trim().min(4).max(160),
      confirmedAmountCents: z.coerce.number().int().positive().safe(),
      note: z.string().trim().max(1000),
      idempotencyKey: uuid,
    })
    .safeParse({
      payoutId: formData.get("payoutId"),
      transferDate: formData.get("transferDate"),
      bankLabel: formData.get("bankLabel"),
      externalReference: formData.get("externalReference"),
      confirmedAmountCents: formData.get("confirmedAmountCents"),
      note: formData.get("note") ?? "",
      idempotencyKey: formData.get("idempotencyKey"),
    });
  if (!parsed.success) return fail();
  const { client } = await requireMarketplacePayoutsManager(
    `/operacion/marketplace/payouts/${parsed.data.payoutId}`,
  );
  const { error } = await client.rpc("record_marketplace_manual_transfer", {
    requested_payout_id: parsed.data.payoutId,
    requested_transfer_date: parsed.data.transferDate,
    requested_bank_label: parsed.data.bankLabel,
    requested_external_reference: parsed.data.externalReference,
    requested_confirmed_amount_cents: parsed.data.confirmedAmountCents,
    requested_note: parsed.data.note,
    requested_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error)
    return fail(
      error.message.includes("amount")
        ? "El monto debe coincidir exactamente con el payout."
        : undefined,
    );
  refresh(parsed.data.payoutId);
  return {
    status: "success",
    message: "Transferencia externa registrada; falta confirmar settlement.",
  };
}

export async function payoutHoldAction(
  _state: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const parsed = z
    .object({
      payoutId: uuid,
      reason,
      source: z.enum(["OPERATIONS", "RISK", "RECONCILIATION"]),
      partnerVisible: z.enum(["true", "false"]),
      idempotencyKey: uuid,
    })
    .safeParse({
      payoutId: formData.get("payoutId"),
      reason: formData.get("reason"),
      source: formData.get("source"),
      partnerVisible: formData.get("partnerVisible"),
      idempotencyKey: formData.get("idempotencyKey"),
    });
  if (!parsed.success) return fail();
  const { client } = await requireMarketplacePayoutsManager(
    `/operacion/marketplace/payouts/${parsed.data.payoutId}`,
  );
  const { error } = await client.rpc("place_marketplace_partner_payout_hold", {
    requested_payout_id: parsed.data.payoutId,
    requested_source: parsed.data.source,
    requested_reason: parsed.data.reason,
    requested_partner_visible: parsed.data.partnerVisible === "true",
    requested_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) return fail();
  refresh(parsed.data.payoutId);
  return { status: "success", message: "Payout puesto en revisión." };
}

export async function releasePayoutHoldAction(
  _state: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const parsed = z
    .object({ payoutId: uuid, holdId: uuid, reason, idempotencyKey: uuid })
    .safeParse({
      payoutId: formData.get("payoutId"),
      holdId: formData.get("holdId"),
      reason: formData.get("reason"),
      idempotencyKey: formData.get("idempotencyKey"),
    });
  if (!parsed.success) return fail();
  const { client } = await requireMarketplacePayoutsManager(
    `/operacion/marketplace/payouts/${parsed.data.payoutId}`,
  );
  const { error } = await client.rpc(
    "release_marketplace_partner_payout_hold",
    {
      requested_hold_id: parsed.data.holdId,
      requested_reason: parsed.data.reason,
      requested_idempotency_key: parsed.data.idempotencyKey,
    },
  );
  if (error) return fail();
  refresh(parsed.data.payoutId);
  return { status: "success", message: "Hold de payout liberado." };
}

export async function runWeeklyPayoutPreparationAction(
  _state: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const parsed = z
    .object({
      calculationDate: z.iso.date(),
      executionKey: z.string().min(8).max(160),
    })
    .safeParse({
      calculationDate: formData.get("calculationDate"),
      executionKey: formData.get("executionKey"),
    });
  if (!parsed.success) return fail();
  const { client } = await requireMarketplacePayoutsManager(
    "/operacion/marketplace/payouts",
  );
  const { error } = await client.rpc("run_marketplace_payout_job", {
    requested_date: parsed.data.calculationDate,
    requested_execution_key: parsed.data.executionKey,
  });
  if (error) return fail();
  refresh();
  return {
    status: "success",
    message: "Candidatos semanales preparados sin ejecutar transferencias.",
  };
}
