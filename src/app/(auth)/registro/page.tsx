import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Crear Mi Golf | Peter Golf",
};

export default function RegisterPage() {
  return (
    <AuthShell
      title="Crea tu acceso a Mi Golf"
      description="Usa tu correo y una contraseña segura. Te enviaremos un mensaje para confirmar tu acceso."
    >
      <RegisterForm />
    </AuthShell>
  );
}
