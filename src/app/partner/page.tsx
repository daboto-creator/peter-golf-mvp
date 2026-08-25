import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentPartnerContext } from "@/lib/marketplace/partner-data";
import {
  getOnboardingCompletion,
  partnerStatusCopy,
} from "@/lib/marketplace/partner-rules";

export const metadata: Metadata = {
  title: "Portal Partner | Best Round Pro Shop",
};

export default async function PartnerDashboard() {
  const { partner, readiness, documents } = await getCurrentPartnerContext();
  if (!partner) redirect("/partner/onboarding");
  const completion = getOnboardingCompletion({
    basic_complete: readiness?.basic_complete === true,
    fiscal_complete: readiness?.fiscal_complete === true,
    documents_complete: readiness?.documents_complete === true,
    review_ready: readiness?.review_ready === true,
  });
  const nextHref =
    partner.status === "REGISTERED" || !readiness?.basic_complete
      ? "/partner/onboarding/datos"
      : !readiness.fiscal_complete
        ? "/partner/onboarding/fiscal"
        : !readiness.documents_complete
          ? "/partner/onboarding/documentos"
          : partner.status === "IDENTITY_PENDING"
            ? "/partner/onboarding/revision"
            : "/partner/verificacion";
  const nextLabel =
    partner.status === "REGISTERED" || !readiness?.basic_complete
      ? "Completar perfil"
      : !readiness.fiscal_complete
        ? "Completar información fiscal"
        : !readiness.documents_complete
          ? "Subir documento"
          : partner.status === "IDENTITY_PENDING"
            ? "Revisar y enviar"
            : partner.status === "UNDER_REVIEW"
              ? "Ver revisión"
              : partner.status === "VERIFIED"
                ? "Ver cuenta verificada"
                : "Ver estado";
  return (
    <div className="space-y-8">
      <header>
        <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
          Best Round Partner
        </p>
        <h1 className="text-pg-black mt-3 text-4xl font-semibold tracking-[-0.035em]">
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-3">
          Tu perfil, verificación y próximo paso en un solo lugar.
        </p>
      </header>
      <div className="grid gap-5 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Estado</CardTitle>
            <CardDescription>
              {partnerStatusCopy[partner.status].label}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6">
              {partnerStatusCopy[partner.status].description}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Perfil</CardTitle>
            <CardDescription>
              {completion.completed} de {completion.total} criterios técnicos
              completos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="h-2 overflow-hidden rounded-full bg-black/10"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={completion.total}
              aria-valuenow={completion.completed}
              aria-label={`${completion.completed} de ${completion.total} criterios completos`}
            >
              <div
                className="bg-pg-gold h-full"
                style={{ width: `${completion.percentage}%` }}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Documentos</CardTitle>
            <CardDescription>
              {documents.length} recibido{documents.length === 1 ? "" : "s"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Sólo tú y Operations autorizado pueden consultarlos.
            </p>
          </CardContent>
        </Card>
      </div>
      <Card className="border-pg-gold/40">
        <CardHeader>
          <CardTitle>Próximo paso</CardTitle>
          <CardDescription>
            {partner.status === "VERIFIED"
              ? "La publicación de productos estará disponible próximamente."
              : partnerStatusCopy[partner.status].description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={nextHref}>{nextLabel}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
