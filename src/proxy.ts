import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSafeInternalPath } from "@/lib/auth/redirect";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import type { Database } from "@/types/database.types";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  let isAuthenticated = false;

  try {
    const { url, anonKey } = getSupabasePublicConfig();
    const supabase = createServerClient<Database>(url, anonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { data, error } = await supabase.auth.getClaims();
    isAuthenticated = !error && Boolean(data?.claims?.sub);
  } catch {
    isAuthenticated = false;
  }

  if (
    (request.nextUrl.pathname.startsWith("/cuenta") ||
      request.nextUrl.pathname.startsWith("/operacion") ||
      request.nextUrl.pathname.startsWith("/partner") ||
      request.nextUrl.pathname.startsWith("/carrito") ||
      request.nextUrl.pathname.startsWith("/checkout") ||
      request.nextUrl.pathname.startsWith("/pedido-confirmado")) &&
    !isAuthenticated
  ) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/iniciar-sesion";
    loginUrl.search = "";
    loginUrl.searchParams.set(
      "next",
      getSafeInternalPath(
        `${request.nextUrl.pathname}${request.nextUrl.search}`,
        request.nextUrl.pathname.startsWith("/operacion")
          ? "/operacion"
          : request.nextUrl.pathname.startsWith("/partner")
            ? "/partner"
            : request.nextUrl.pathname.startsWith("/cuenta")
              ? "/cuenta"
              : "/productos",
      ),
    );
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/health/supabase|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
