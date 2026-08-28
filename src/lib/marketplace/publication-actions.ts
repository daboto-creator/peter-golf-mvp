"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { serverEnv } from "@/env/server";
import { requireMarketplaceConfigurationManager } from "@/lib/auth/marketplace-authorization";
import type { PartnerActionState } from "@/lib/marketplace/partner-action-state";
import { getMarketplaceActivationReadiness } from "@/lib/marketplace/publication-data";
import { isSafeMarketplaceActivationEnvironment } from "@/lib/marketplace/publication-rules";

const requestSchema = z.object({
  enabled: z.enum(["true", "false"]).transform((value) => value === "true"),
  expectedEnabled: z
    .enum(["true", "false"])
    .transform((value) => value === "true"),
  confirmed: z.literal("on"),
  reason: z.string().trim().min(3).max(500),
});

export async function setMarketplaceEnabledAction(
  _state: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const { client } = await requireMarketplaceConfigurationManager(
    "/operacion/marketplace/configuracion",
  );
  const parsed = requestSchema.safeParse({
    enabled: formData.get("enabled"),
    expectedEnabled: formData.get("expectedEnabled"),
    confirmed: formData.get("confirmed"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Confirma la acción e indica una razón.",
    };
  }
  if (
    !isSafeMarketplaceActivationEnvironment(
      serverEnv.APP_ENV,
      serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    )
  ) {
    return {
      status: "error",
      message: "La activación pública sólo está permitida en staging.",
    };
  }
  if (parsed.data.enabled) {
    const readiness = await getMarketplaceActivationReadiness();
    if (!readiness?.ready) {
      return {
        status: "error",
        message: "Marketplace no cumple todos los controles de readiness.",
      };
    }
  }
  const { error } = await client.rpc("set_marketplace_enabled", {
    expected_enabled: parsed.data.expectedEnabled,
    requested_confirmation: parsed.data.enabled
      ? "ENABLE_MARKETPLACE"
      : "DISABLE_MARKETPLACE",
    requested_enabled: parsed.data.enabled,
    requested_reason: parsed.data.reason,
  });
  if (error) {
    console.warn(
      JSON.stringify({
        event: "marketplace_activation_failed",
        operation: parsed.data.enabled ? "enable" : "disable",
        code: error.code,
      }),
    );
    return {
      status: "error",
      message: "No se pudo cambiar el estado de Marketplace.",
    };
  }
  console.info(
    JSON.stringify({
      event: "marketplace_activation_changed",
      enabled: parsed.data.enabled,
    }),
  );
  revalidatePath("/productos");
  revalidatePath("/operacion/marketplace/configuracion");
  revalidatePath("/operacion/marketplace/publicaciones");
  return {
    status: "success",
    message: parsed.data.enabled
      ? "Marketplace quedó activado. Los listings elegibles pueden publicarse."
      : "Marketplace quedó desactivado para nuevas publicaciones y compras.",
  };
}
