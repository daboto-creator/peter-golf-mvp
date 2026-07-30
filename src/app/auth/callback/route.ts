import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { getSafeInternalPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = getSafeInternalPath(
    request.nextUrl.searchParams.get("next"),
    "/cuenta",
  );

  if (!code) {
    return NextResponse.redirect(
      new URL("/iniciar-sesion?error=confirmacion", request.url),
    );
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(
        new URL("/iniciar-sesion?error=confirmacion", request.url),
      );
    }

    if (next === "/actualizar-contrasena") {
      const cookieStore = await cookies();
      cookieStore.set("pg-password-recovery", "1", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/actualizar-contrasena",
        maxAge: 10 * 60,
      });
    }

    const destination = new URL(next, request.url);
    if (next === "/cuenta") {
      destination.searchParams.set("confirmado", "1");
    }
    return NextResponse.redirect(destination);
  } catch {
    return NextResponse.redirect(
      new URL("/iniciar-sesion?error=confirmacion", request.url),
    );
  }
}
