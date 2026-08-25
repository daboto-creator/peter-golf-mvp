import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentPartnerContext } from "@/lib/marketplace/partner-data";

export default async function OnboardingWelcomePage() {
  const { partner } = await getCurrentPartnerContext();
  if (partner)
    redirect(
      partner.status === "REGISTERED"
        ? "/partner/onboarding/datos"
        : "/partner",
    );
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
          Vende con Best Round
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em]">
          Conviértete en Best Round Partner
        </h1>
        <p className="text-muted-foreground mt-4 leading-7">
          Prepara tu perfil para vender equipo de golf con una experiencia
          curada por Best Round.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Un proceso sencillo y seguro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6">
          <ul className="list-disc space-y-2 pl-5">
            <li>Completa tus datos por pasos y continúa cuando quieras.</li>
            <li>Tu identidad y documentos se revisan de forma privada.</li>
            <li>
              Toda publicación futura estará sujeta a aprobación Best Round.
            </li>
          </ul>
          <Button asChild>
            <Link href="/partner/onboarding/tipo">Comenzar</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
