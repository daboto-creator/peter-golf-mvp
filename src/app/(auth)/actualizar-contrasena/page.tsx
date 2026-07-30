import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";

import { AuthShell } from "@/components/auth/auth-shell";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getAuthenticatedUser } from "@/lib/auth/user";

export const metadata: Metadata = {
  title: "Nueva contraseña | Peter Golf",
};

export default async function UpdatePasswordPage() {
  const cookieStore = await cookies();
  const isRecovery = cookieStore.get("pg-password-recovery")?.value === "1";
  const user = isRecovery ? await getAuthenticatedUser() : null;

  return (
    <AuthShell
      title="Establece una nueva contraseña"
      description="Elige una contraseña distinta y difícil de adivinar."
    >
      {user ? (
        <UpdatePasswordForm />
      ) : (
        <div className="space-y-5">
          <Alert variant="destructive">
            <AlertDescription>
              El enlace de recuperación no es válido o ya venció.
            </AlertDescription>
          </Alert>
          <Link
            href="/recuperar-contrasena"
            className="block text-center text-sm font-medium underline underline-offset-4"
          >
            Solicitar un enlace nuevo
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
