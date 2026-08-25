"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  requireMarketplaceOrdersManager,
  requireMarketplacePartner,
} from "@/lib/auth/marketplace-authorization";
import type { PartnerActionState } from "@/lib/marketplace/partner-action-state";

const payloadSchema = z.object({
  fulfillmentId: z.uuid(),
  version: z.coerce.number().int().positive(),
  action: z.string().min(3).max(80),
  reason: z.string().trim().max(500).default(""),
  idempotencyKey: z.uuid(),
});

function parse(formData: FormData) {
  return payloadSchema.safeParse({
    fulfillmentId: formData.get("fulfillmentId"),
    version: formData.get("version"),
    action: formData.get("action"),
    reason: formData.get("reason"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
}

function failure(): PartnerActionState {
  return {
    status: "error",
    message:
      "No pudimos actualizar esta venta. Recarga e inténtalo nuevamente.",
  };
}

export async function transitionPartnerFulfillmentAction(
  _state: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const parsed = parse(formData);
  if (!parsed.success) return failure();
  const { client } = await requireMarketplacePartner(
    `/partner/ventas/${parsed.data.fulfillmentId}`,
  );
  const { error } = await client.rpc("transition_partner_fulfillment", {
    requested_fulfillment_id: parsed.data.fulfillmentId,
    expected_version: parsed.data.version,
    requested_action: parsed.data.action,
    requested_reason: parsed.data.reason,
    requested_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) return failure();
  revalidatePath("/partner/ventas");
  revalidatePath(`/partner/ventas/${parsed.data.fulfillmentId}`);
  return { status: "success", message: "Venta actualizada." };
}

export async function transitionOperationsFulfillmentAction(
  _state: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const parsed = parse(formData);
  if (!parsed.success || parsed.data.reason.length < 3) return failure();
  const { client } = await requireMarketplaceOrdersManager(
    "/operacion/marketplace/ordenes",
  );
  const { error } = await client.rpc("transition_marketplace_fulfillment", {
    requested_fulfillment_id: parsed.data.fulfillmentId,
    expected_version: parsed.data.version,
    requested_action: parsed.data.action,
    requested_reason: parsed.data.reason,
    requested_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) return failure();
  revalidatePath("/operacion/marketplace/ordenes");
  return { status: "success", message: "Fulfillment actualizado." };
}
