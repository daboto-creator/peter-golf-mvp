import "server-only";

import { forbidden, redirect } from "next/navigation";

import { getSafeInternalPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export async function requireOrdersManager(returnTo = "/operacion/pedidos") {
  let authenticated = false;
  let authorized = false;
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (!userError && userData.user) {
      authenticated = true;
      const { data, error } = await supabase.rpc("can_manage_orders");
      authorized = !error && data === true;
    }
  } catch {
    authenticated = false;
  }
  if (!authenticated) {
    const safe = getSafeInternalPath(returnTo, "/operacion/pedidos");
    redirect(`/iniciar-sesion?next=${encodeURIComponent(safe)}`);
  }
  if (!authorized) forbidden();
}
