import { redirect } from "next/navigation";

import { IdentityVerificationStatus } from "@/components/marketplace/identity-verification-status";
import { IdentityVerificationForm } from "@/components/marketplace/partner-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  identityOnboardingNextRoute,
  resolveIdentityOnboardingState,
} from "@/lib/marketplace/identity-onboarding";
import { getCurrentPartnerContext } from "@/lib/marketplace/partner-data";
import { isPartnerReadOnly } from "@/lib/marketplace/partner-rules";

export default async function PartnerIdentityPage() {
  const { partner, identityVerifications } = await getCurrentPartnerContext();
  if (!partner) redirect("/partner/onboarding");
  if (isPartnerReadOnly(partner.status)) redirect("/partner/verificacion");
  const latest = identityVerifications[0];
  const company = partner.legal_type === "LEGAL_ENTITY";
  const state = resolveIdentityOnboardingState(latest?.result);
  if (state.shouldAdvance) {
    redirect(identityOnboardingNextRoute(partner.legal_type));
  }
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
          {state.message ? (
            <IdentityVerificationStatus
              message={state.message}
              shouldPoll={state.shouldPoll}
            />
          ) : null}
          {state.canStart && state.actionLabel ? (
            <IdentityVerificationForm label={state.actionLabel} />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
