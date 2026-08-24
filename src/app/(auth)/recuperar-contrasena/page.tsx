import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { RecoveryForm } from "@/components/auth/recovery-form";

export const metadata: Metadata = {
  title: "Recuperar contraseña | Best Round Pro Shop",
};

export default function RecoverPasswordPage() {
  return (
    <AuthShell
      title="Recupera tu contraseña"
      description="Escribe tu correo. Si está asociado a una cuenta, recibirás un enlace seguro."
    >
      <RecoveryForm />
    </AuthShell>
  );
}
