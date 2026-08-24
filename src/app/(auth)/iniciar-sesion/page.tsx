import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getSafeInternalPath } from "@/lib/auth/redirect";

export const metadata: Metadata = {
  title: "Iniciar sesión | Best Round Pro Shop",
};

type SearchParams = Promise<{
  next?: string | string[];
  error?: string | string[];
  sesion?: string | string[];
  contrasena?: string | string[];
}>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const next = getSafeInternalPath(
    typeof query.next === "string" ? query.next : undefined,
  );
  const callbackError = query.error === "confirmacion";
  const signedOut = query.sesion === "cerrada";
  const passwordUpdated = query.contrasena === "actualizada";

  return (
    <AuthShell
      title="Inicia sesión"
      description="Accede a Mi Golf para consultar tu perfil, direcciones y pedidos."
    >
      <div className="space-y-5">
        {callbackError ? (
          <Alert variant="destructive">
            <AlertDescription>
              El enlace no es válido o ya venció. Solicita uno nuevo.
            </AlertDescription>
          </Alert>
        ) : null}
        {signedOut ? (
          <Alert variant="success">
            <AlertDescription>
              Tu sesión se cerró correctamente.
            </AlertDescription>
          </Alert>
        ) : null}
        {passwordUpdated ? (
          <Alert variant="success">
            <AlertDescription>
              Tu contraseña se actualizó. Ya puedes iniciar sesión.
            </AlertDescription>
          </Alert>
        ) : null}
        <LoginForm next={next} />
      </div>
    </AuthShell>
  );
}
