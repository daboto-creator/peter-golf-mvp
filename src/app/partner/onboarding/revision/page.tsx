import Link from "next/link";
import { redirect } from "next/navigation";

import { SubmitPartnerForm } from "@/components/marketplace/partner-forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentPartnerContext } from "@/lib/marketplace/partner-data";
import {
  legalTypeCopy,
  partnerStatusCopy,
} from "@/lib/marketplace/partner-rules";

export default async function PartnerReviewPage() {
  const { partner, readiness, documents } = await getCurrentPartnerContext();
  if (!partner) redirect("/partner/onboarding");
  const editable =
    partner.status === "REGISTERED" || partner.status === "IDENTITY_PENDING";
  const checks = [
    ["Información básica", readiness?.basic_complete],
    ["Información fiscal", readiness?.fiscal_complete],
    ["Documento", readiness?.documents_complete],
  ] as const;
  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <header>
        <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
          Paso 4 de 4 · Listo
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Revisa tu solicitud</h1>
        <p className="text-muted-foreground mt-3">
          Confirma que todo esté listo antes de enviarlo a Best Round.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>{legalTypeCopy[partner.legal_type].label}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2">
            {checks.map(([label, complete], index) => (
              <li
                key={label}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                <span>{label}</span>
                <strong
                  className={complete ? "text-pg-success" : "text-destructive"}
                >
                  {complete ? "Completo" : "Pendiente"}
                </strong>
                {!complete ? (
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={
                        index === 0
                          ? "/partner/onboarding/datos"
                          : index === 1
                            ? "/partner/onboarding/fiscal"
                            : "/partner/onboarding/documentos"
                      }
                    >
                      Completar
                    </Link>
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-sm">
            {documents.length} documento{documents.length === 1 ? "" : "s"}{" "}
            recibido{documents.length === 1 ? "" : "s"}.
          </p>
          {editable ? (
            <div className="flex flex-wrap gap-3">
              <SubmitPartnerForm ready={readiness?.review_ready === true} />
              <Button asChild variant="outline">
                <Link href="/partner/onboarding/datos">Editar datos</Link>
              </Button>
            </div>
          ) : (
            <p className="rounded-xl bg-black/5 p-4 text-sm">
              <strong>{partnerStatusCopy[partner.status].label}.</strong>{" "}
              {partnerStatusCopy[partner.status].description}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
