import "server-only";

import { forbidden, redirect } from "next/navigation";

import { serverEnv } from "@/env/server";
import { getSafeInternalPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export async function getMarketplaceAvailability(): Promise<boolean> {
  if (!serverEnv.MARKETPLACE_ENABLED) return false;
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("is_marketplace_enabled");
    return !error && data === true;
  } catch {
    return false;
  }
}

export async function requireMarketplaceUser(returnTo = "/partner") {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    redirect(
      `/iniciar-sesion?next=${encodeURIComponent(getSafeInternalPath(returnTo, "/partner"))}`,
    );
  }
  if (!(await getMarketplaceAvailability())) {
    redirect("/cuenta?marketplace=no-disponible");
  }
  return { client, user };
}

export async function requireMarketplacePartner(returnTo = "/partner") {
  const { client, user } = await requireMarketplaceUser(returnTo);
  const { data: partner } = await client
    .from("partner_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!partner) redirect("/partner/onboarding");
  return { client, user, partner };
}

export async function requirePartnerManager(returnTo: string) {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    redirect(
      `/iniciar-sesion?next=${encodeURIComponent(getSafeInternalPath(returnTo, "/operacion"))}`,
    );
  }
  const { data } = await client.rpc("can_manage_marketplace_partners");
  if (data !== true) forbidden();
  return { client, user };
}
