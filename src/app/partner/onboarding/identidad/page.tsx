import Link from "next/link";
import { redirect } from "next/navigation";

import { IdentityVerificationForm } from "@/components/marketplace/partner-forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentPartnerContext } from "@/lib/marketplace/partner-data";
import { isPartnerReadOnly } from "@/lib/marketplace/partner-rules";

export default async function PartnerIdentityPage() {
  const { partner, identityVerifications } = await getCurrentPartnerContext();
  if (!partner) redirect("/partner/onboarding");
  if (isPartnerReadOnly(partner.status)) redirect("/partner/verificacion");
  const latest = identityVerifications[0];
  const company = partner.legal_type === "LEGAL_ENTITY";
  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <header>
        <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
          Paso 2 de 4 · Identidad
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Verifica tu identidad</h1>
        <p className="text-muted-foreground mt-3">
          {company
            ? "La validación de una Persona Moral es documental y siempre incluye revisión de Best Round."
            : "Completa una validación segura de identificación, selfie y prueba de vida. Puedes usar pasaporte vigente; no necesitas INE si eres residente extranjero."}
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Validación protegida</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {latest ? (
            <p className="rounded-xl border p-4 text-sm">
              {latest.result === "PASSED"
                ? "Validación recibida. Best Round hará la revisión final."
                : latest.result === "FAILED"
                  ? "Necesitamos que revises o repitas tu validación."
                  : "Tu validación está en proceso o requiere revisión."}
            </p>
          ) : null}
          <IdentityVerificationForm />
          <Button asChild variant="outline">
            <Link
              href={
                company
                  ? "/partner/onboarding/fiscal"
                  : "/partner/onboarding/documentos"
              }
            >
              Continuar con documentos
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
