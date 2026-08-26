"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMarketplaceClaimsManager } from "@/lib/auth/marketplace-authorization";
import { isBuyerClaimReason } from "@/lib/marketplace/claim-rules";
import { validateListingImageSignature } from "@/lib/marketplace/listing-rules";
import type { PartnerActionState } from "@/lib/marketplace/partner-action-state";
import { createClient } from "@/lib/supabase/server";

const uuid = z.uuid();
const failed: PartnerActionState = {
  status: "error",
  message: "No pudimos completar la acción. Recarga e inténtalo nuevamente.",
};

export async function acceptDeliveryAction(
  _state: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const parsed = z
    .object({ fulfillmentId: uuid, idempotencyKey: uuid })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failed;
  const client = await createClient();
  const { error } = await client.rpc("accept_marketplace_delivery", {
    requested_fulfillment_id: parsed.data.fulfillmentId,
    requested_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) return failed;
  revalidatePath("/cuenta/pedidos");
  return { status: "success", message: "Entrega aceptada. Gracias." };
}

export async function openClaimAction(
  _state: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const parsed = z
    .object({
      orderItemId: uuid,
      reason: z.string(),
      description: z.string().trim().min(10).max(2000),
      idempotencyKey: uuid,
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success || !isBuyerClaimReason(parsed.data.reason)) return failed;
  const client = await createClient();
  const { error } = await client.rpc("open_marketplace_claim", {
    requested_order_item_id: parsed.data.orderItemId,
    requested_reason: parsed.data.reason,
    requested_description: parsed.data.description,
    requested_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) return failed;
  revalidatePath("/cuenta/pedidos");
  return {
    status: "success",
    message: "Recibimos tu reporte. Best Round lo revisará.",
  };
}

export async function partnerClaimResponseAction(
  _state: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const parsed = z
    .object({
      claimId: uuid,
      response: z.string().trim().min(10).max(2000),
      idempotencyKey: uuid,
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failed;
  const client = await createClient();
  const { error } = await client.rpc(
    "submit_marketplace_claim_partner_response",
    {
      requested_claim_id: parsed.data.claimId,
      requested_response: parsed.data.response,
      requested_idempotency_key: parsed.data.idempotencyKey,
    },
  );
  if (error) return failed;
  revalidatePath("/partner/ventas");
  return { status: "success", message: "Respuesta enviada a Best Round." };
}

export async function uploadClaimEvidenceAction(
  _state: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const claimId = uuid.safeParse(formData.get("claimId"));
  const idempotencyKey = uuid.safeParse(formData.get("idempotencyKey"));
  const note = z
    .string()
    .trim()
    .max(500)
    .safeParse(formData.get("note") ?? "");
  const file = formData.get("evidence");
  if (
    !claimId.success ||
    !idempotencyKey.success ||
    !note.success ||
    !(file instanceof File) ||
    file.size < 1 ||
    file.size > 10 * 1024 * 1024 ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  )
    return failed;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validateListingImageSignature(file.type, bytes.slice(0, 16)))
    return {
      status: "error",
      message: "El contenido no coincide con el formato declarado.",
    };
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return failed;
  const extension =
    file.type === "image/jpeg"
      ? "jpg"
      : file.type === "image/png"
        ? "png"
        : "webp";
  const path = `${user.id}/${claimId.data}/${randomUUID()}.${extension}`;
  const upload = await client.storage
    .from("marketplace-claim-evidence")
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (upload.error) return failed;
  const registration = await client.rpc("register_marketplace_claim_evidence", {
    requested_claim_id: claimId.data,
    requested_storage_path: path,
    requested_mime_type: file.type,
    requested_size_bytes: file.size,
    requested_note: note.data,
    requested_idempotency_key: idempotencyKey.data,
  });
  if (registration.error) {
    await client.storage.from("marketplace-claim-evidence").remove([path]);
    return failed;
  }
  revalidatePath("/cuenta/pedidos");
  return { status: "success", message: "Evidencia privada agregada." };
}

export async function updateClaimReviewAction(
  _state: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const parsed = z
    .object({
      claimId: uuid,
      status: z.enum([
        "UNDER_REVIEW",
        "EVIDENCE_REQUESTED",
        "PARTNER_RESPONSE_PENDING",
      ]),
      reason: z.string().trim().min(3).max(2000),
      idempotencyKey: uuid,
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failed;
  const { client } = await requireMarketplaceClaimsManager(
    `/operacion/marketplace/reclamos/${parsed.data.claimId}`,
  );
  const { error } = await client.rpc("update_marketplace_claim_review", {
    requested_claim_id: parsed.data.claimId,
    requested_status: parsed.data.status,
    requested_reason: parsed.data.reason,
    requested_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) return failed;
  revalidatePath(`/operacion/marketplace/reclamos/${parsed.data.claimId}`);
  return { status: "success", message: "Revisión actualizada." };
}

export async function resolveClaimAction(
  _state: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const parsed = z
    .object({
      claimId: uuid,
      decision: z.enum(["APPROVED", "PARTIALLY_APPROVED", "REJECTED"]),
      responsibility: z.enum([
        "PARTNER_RESPONSIBLE",
        "BUYER_NOT_SUPPORTED",
        "BEST_ROUND_OPERATIONAL",
        "INCONCLUSIVE",
        "NO_FAULT",
      ]),
      adjustmentCents: z.coerce.number().int().nonnegative().safe(),
      returnRequirement: z.enum([
        "NO_RETURN_REQUIRED",
        "RETURN_REQUIRED",
        "RETURN_WAIVED",
        "MANUAL_REVIEW",
      ]),
      reason: z.string().trim().min(3).max(2000),
      evidenceSummary: z.string().trim().min(3).max(2000),
      buyerOutcome: z.string().trim().min(3).max(1000),
      idempotencyKey: uuid,
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failed;
  const { client } = await requireMarketplaceClaimsManager(
    `/operacion/marketplace/reclamos/${parsed.data.claimId}`,
  );
  const { error } = await client.rpc("resolve_marketplace_claim", {
    requested_claim_id: parsed.data.claimId,
    requested_decision: parsed.data.decision,
    requested_responsibility: parsed.data.responsibility,
    requested_adjustment_cents:
      parsed.data.decision === "PARTIALLY_APPROVED"
        ? parsed.data.adjustmentCents
        : 0,
    requested_return_requirement: parsed.data.returnRequirement,
    requested_reason: parsed.data.reason,
    requested_evidence_summary: parsed.data.evidenceSummary,
    requested_buyer_outcome: parsed.data.buyerOutcome,
    requested_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) return failed;
  revalidatePath("/operacion/marketplace/reclamos");
  revalidatePath(`/operacion/marketplace/reclamos/${parsed.data.claimId}`);
  return { status: "success", message: "Resolución financiera registrada." };
}

export async function setClaimEvidencePartnerVisibilityAction(
  _state: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const parsed = z
    .object({
      claimId: uuid,
      evidenceId: uuid,
      partnerVisible: z.enum(["true", "false"]),
      reason: z.string().trim().min(3).max(1000),
      idempotencyKey: uuid,
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failed;
  const { client } = await requireMarketplaceClaimsManager(
    `/operacion/marketplace/reclamos/${parsed.data.claimId}`,
  );
  const { error } = await client.rpc(
    "set_marketplace_claim_evidence_partner_visibility",
    {
      requested_evidence_id: parsed.data.evidenceId,
      requested_partner_visible: parsed.data.partnerVisible === "true",
      requested_reason: parsed.data.reason,
      requested_idempotency_key: parsed.data.idempotencyKey,
    },
  );
  if (error) return failed;
  revalidatePath(`/operacion/marketplace/reclamos/${parsed.data.claimId}`);
  return {
    status: "success",
    message: "Visibilidad de evidencia actualizada.",
  };
}

export async function transitionMarketplaceReturnAction(
  _state: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const parsed = z
    .object({
      claimId: uuid,
      returnId: uuid,
      status: z.enum([
        "AWAITING_SHIPMENT",
        "IN_TRANSIT",
        "RECEIVED",
        "INSPECTING",
        "ACCEPTED",
        "REJECTED",
        "CLOSED",
      ]),
      carrier: z.string().trim().max(80),
      trackingNumber: z.string().trim().max(120),
      inspectionResult: z.string().trim().max(2000),
      reason: z.string().trim().min(3).max(1000),
      idempotencyKey: uuid,
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failed;
  const { client } = await requireMarketplaceClaimsManager(
    `/operacion/marketplace/reclamos/${parsed.data.claimId}`,
  );
  const { error } = await client.rpc("transition_marketplace_return", {
    requested_return_id: parsed.data.returnId,
    requested_status: parsed.data.status,
    requested_carrier: parsed.data.carrier,
    requested_tracking_number: parsed.data.trackingNumber,
    requested_inspection_result: parsed.data.inspectionResult,
    requested_reason: parsed.data.reason,
    requested_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) return failed;
  revalidatePath(`/operacion/marketplace/reclamos/${parsed.data.claimId}`);
  return { status: "success", message: "Devolución actualizada." };
}
