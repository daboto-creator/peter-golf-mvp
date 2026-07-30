import "server-only";

import { forbidden, redirect } from "next/navigation";

import {
  resolveCatalogAuthorization,
  type CatalogAuthorization,
} from "@/lib/auth/authorization-state";
import { getSafeInternalPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export async function getCatalogAuthorization(): Promise<CatalogAuthorization> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return "unauthenticated";
    }

    const { data, error } = await supabase.rpc("can_manage_catalog");
    return resolveCatalogAuthorization(user.id, !error && data === true);
  } catch {
    return "unauthenticated";
  }
}

export async function canCurrentUserManageCatalog(): Promise<boolean> {
  return (await getCatalogAuthorization()) === "authorized";
}

export async function requireCatalogManager(
  returnTo = "/operacion",
): Promise<void> {
  const authorization = await getCatalogAuthorization();

  if (authorization === "unauthenticated") {
    const safeReturnTo = getSafeInternalPath(returnTo, "/operacion");
    redirect(`/iniciar-sesion?next=${encodeURIComponent(safeReturnTo)}`);
  }

  if (authorization === "forbidden") {
    forbidden();
  }
}
