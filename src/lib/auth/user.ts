import "server-only";

import { redirect } from "next/navigation";

import { getSafeInternalPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return error ? null : user;
}

export async function requireAuthenticatedUser(returnTo = "/cuenta") {
  const user = await getAuthenticatedUser();

  if (!user) {
    const safeReturnTo = getSafeInternalPath(returnTo);
    redirect(`/iniciar-sesion?next=${encodeURIComponent(safeReturnTo)}`);
  }

  return user;
}
