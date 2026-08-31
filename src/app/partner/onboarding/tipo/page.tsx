import { redirect } from "next/navigation";

import { PartnerTypeForm } from "@/components/marketplace/partner-forms";
import { getCurrentPartnerContext } from "@/lib/marketplace/partner-data";

export default async function PartnerTypePage() {
  const { partner } = await getCurrentPartnerContext();
  if (partner) redirect("/partner/onboarding/datos");
  return (
    <OnboardingPage
      step="1 de 4 · Datos"
      title="Cuéntanos cómo venderás"
      description="Elige la opción que describe mejor tu actividad."
    >
      <PartnerTypeForm />
    </OnboardingPage>
  );
}

function OnboardingPage({
  step,
  title,
  description,
  children,
}: {
  step: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-7">
      <header>
        <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
          Paso {step}
        </p>
        <h1 className="mt-3 text-3xl font-semibold">{title}</h1>
        <p className="text-muted-foreground mt-3">{description}</p>
      </header>
      {children}
    </div>
  );
}
