"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireScoreTierManager } from "@/lib/auth/marketplace-authorization";
import type { PartnerActionState } from "@/lib/marketplace/partner-action-state";

const uuid = z.uuid();
const reason = z.string().trim().min(3).max(500);

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry : "";
}

function failure(message?: string): PartnerActionState {
  if (message?.includes("version conflict"))
    return {
      status: "error",
      message: "El estado cambió. Actualiza la página.",
    };
  if (message?.includes("access denied"))
    return { status: "error", message: "No tienes permiso para esta acción." };
  return { status: "error", message: "No pudimos actualizar Score y Tier." };
}

function scorePath(partnerId: string) {
  return `/operacion/marketplace/partners/${partnerId}/score`;
}

export async function recalculatePartnerScoreAction(
  _previous: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const partnerId = uuid.safeParse(value(formData, "partner_id"));
  const parsedReason = reason.safeParse(value(formData, "reason"));
  if (!partnerId.success || !parsedReason.success)
    return { status: "error", message: "Indica un motivo válido." };
  const { client } = await requireScoreTierManager(scorePath(partnerId.data));
  const today = new Date().toISOString().slice(0, 10);
  const result = await client.rpc("run_marketplace_score_tier_job", {
    requested_as_of_date: today,
    requested_job_key: `manual:${today}:${randomUUID()}`,
    requested_partner_id: partnerId.data,
    requested_reason: parsedReason.data,
  });
  if (result.error) return failure(result.error.message);
  revalidatePath(scorePath(partnerId.data));
  revalidatePath("/partner/score");
  return {
    status: "success",
    message: "Score recalculado con evidencia vigente.",
  };
}

export async function addPartnerPenaltyAction(
  _previous: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const partnerId = uuid.safeParse(value(formData, "partner_id"));
  const eventCode = z
    .enum([
      "REPEATED_LATE_SHIPMENT",
      "POST_PAYMENT_CANCELLATION",
      "MAJOR_MISMATCH",
      "PARTNER_ATTRIBUTABLE_RETURN",
      "LOST_PARTNER_ATTRIBUTABLE_DISPUTE",
      "CONFIRMED_COUNTERFEIT",
      "DELIBERATE_MANIPULATION",
    ])
    .safeParse(value(formData, "event_code"));
  const parsedReason = reason.safeParse(value(formData, "reason"));
  if (!partnerId.success || !eventCode.success || !parsedReason.success)
    return {
      status: "error",
      message: "Completa la penalización y su motivo.",
    };
  const { client } = await requireScoreTierManager(scorePath(partnerId.data));
  const result = await client.rpc("create_partner_penalty", {
    requested_partner_id: partnerId.data,
    requested_event_code: eventCode.data,
    requested_idempotency_key: `manual-penalty:${randomUUID()}`,
    requested_reason: parsedReason.data,
  });
  if (result.error) return failure(result.error.message);
  revalidatePath(scorePath(partnerId.data));
  return { status: "success", message: "Penalización registrada y auditada." };
}

export async function clearPartnerPenaltyAction(
  _previous: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const partnerId = uuid.safeParse(value(formData, "partner_id"));
  const penaltyId = uuid.safeParse(value(formData, "penalty_id"));
  const parsedReason = reason.safeParse(value(formData, "reason"));
  if (!partnerId.success || !penaltyId.success || !parsedReason.success)
    return { status: "error", message: "Indica el motivo de la liberación." };
  const { client } = await requireScoreTierManager(scorePath(partnerId.data));
  const result = await client.rpc("clear_partner_penalty", {
    requested_penalty_id: penaltyId.data,
    requested_reason: parsedReason.data,
  });
  if (result.error) return failure(result.error.message);
  revalidatePath(scorePath(partnerId.data));
  return { status: "success", message: "Penalización liberada con auditoría." };
}

export async function createPartnerOverrideAction(
  _previous: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const partnerId = uuid.safeParse(value(formData, "partner_id"));
  const overrideType = z
    .enum(["SCORE", "TIER"])
    .safeParse(value(formData, "override_type"));
  const parsedReason = reason.safeParse(value(formData, "reason"));
  const expiresRaw = value(formData, "expires_at");
  const expiresAt = expiresRaw ? new Date(`${expiresRaw}T23:59:59Z`) : null;
  if (
    !partnerId.success ||
    !overrideType.success ||
    !parsedReason.success ||
    (expiresAt && Number.isNaN(expiresAt.valueOf()))
  )
    return { status: "error", message: "Completa el override y su motivo." };
  const score = z.coerce
    .number()
    .int()
    .min(0)
    .max(100)
    .safeParse(value(formData, "score"));
  const tier = z
    .enum(["BOGEY", "PAR", "BIRDIE", "ALBATROSS", "HOLE_IN_ONE"])
    .safeParse(value(formData, "tier"));
  if (
    (overrideType.data === "SCORE" && !score.success) ||
    (overrideType.data === "TIER" && !tier.success)
  )
    return {
      status: "error",
      message: "Selecciona un valor de override válido.",
    };
  const { client } = await requireScoreTierManager(scorePath(partnerId.data));
  const result = await client.rpc("create_partner_score_tier_override", {
    requested_partner_id: partnerId.data,
    requested_type: overrideType.data,
    requested_score_bps:
      overrideType.data === "SCORE" && score.success ? score.data * 100 : null,
    requested_tier:
      overrideType.data === "TIER" && tier.success ? tier.data : null,
    requested_reason: parsedReason.data,
    requested_expires_at: expiresAt?.toISOString(),
  });
  if (result.error) return failure(result.error.message);
  revalidatePath(scorePath(partnerId.data));
  return {
    status: "success",
    message: "Override registrado. Recalcula para aplicarlo.",
  };
}

export async function clearPartnerOverrideAction(
  _previous: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const partnerId = uuid.safeParse(value(formData, "partner_id"));
  const overrideId = uuid.safeParse(value(formData, "override_id"));
  const parsedReason = reason.safeParse(value(formData, "reason"));
  if (!partnerId.success || !overrideId.success || !parsedReason.success)
    return { status: "error", message: "Indica el motivo de la liberación." };
  const { client } = await requireScoreTierManager(scorePath(partnerId.data));
  const result = await client.rpc("clear_partner_score_tier_override", {
    requested_override_id: overrideId.data,
    requested_reason: parsedReason.data,
  });
  if (result.error) return failure(result.error.message);
  revalidatePath(scorePath(partnerId.data));
  return {
    status: "success",
    message: "Override liberado. Recalcula para normalizar.",
  };
}
