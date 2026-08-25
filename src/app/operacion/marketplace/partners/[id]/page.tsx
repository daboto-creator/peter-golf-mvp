import Link from "next/link";
import { notFound } from "next/navigation";

import {
  DocumentReviewForm,
  PartnerStatusForm,
} from "@/components/marketplace/operations-review-forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePartnerManager } from "@/lib/auth/marketplace-authorization";
import { getPartnerForOperations } from "@/lib/marketplace/partner-data";
import {
  documentKindCopy,
  legalTypeCopy,
  partnerDocumentStatusCopy,
  partnerStatusCopy,
  type PartnerStatus,
} from "@/lib/marketplace/partner-rules";

const transitions: Record<PartnerStatus, Array<[string, string]>> = {
  REGISTERED: [["IDENTITY_PENDING", "Solicitar completar identidad"]],
  IDENTITY_PENDING: [],
  UNDER_REVIEW: [
    ["IDENTITY_PENDING", "Solicitar cambios"],
    ["VERIFIED", "Verificar"],
    ["REJECTED", "Rechazar"],
  ],
  VERIFIED: [["SUSPENDED", "Suspender"]],
  SUSPENDED: [
    ["VERIFIED", "Restaurar verificación"],
    ["REJECTED", "Rechazar"],
  ],
  REJECTED: [["IDENTITY_PENDING", "Permitir correcciones"]],
};

export default async function PartnerOperationsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePartnerManager(`/operacion/marketplace/partners/${id}`);
  const result = await getPartnerForOperations(id);
  if (!result.partner || result.error) notFound();
  const partner = result.partner;
  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
            Revisión Partner
          </p>
          <h1 className="mt-3 text-4xl font-semibold">
            {partner.commercial_name ||
              [partner.first_name, partner.last_name]
                .filter(Boolean)
                .join(" ") ||
              "Perfil por completar"}
          </h1>
          <p className="text-muted-foreground mt-3">
            {legalTypeCopy[partner.legal_type].label} ·{" "}
            {partnerStatusCopy[partner.status].label}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/operacion/marketplace/partners">Volver</Link>
        </Button>
      </header>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Perfil privado</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <p>
                <strong>Nombre:</strong>{" "}
                {[partner.first_name, partner.last_name]
                  .filter(Boolean)
                  .join(" ") || "—"}
              </p>
              <p>
                <strong>Empresa:</strong> {partner.commercial_name || "—"}
              </p>
              <p>
                <strong>Representante:</strong>{" "}
                {partner.representative_name || "—"}
              </p>
              <p>
                <strong>Teléfono:</strong> {partner.phone || "—"}
              </p>
              <p>
                <strong>Ubicación:</strong>{" "}
                {[partner.city, partner.state, partner.country_code]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </p>
              <p>
                <strong>RFC:</strong> {partner.tax_id || "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Documentos</CardTitle>
            </CardHeader>
            <CardContent>
              {result.documents.length ? (
                <div className="space-y-5">
                  {result.documents.map((document) => (
                    <article
                      key={document.id}
                      className="rounded-xl border p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <strong>
                            {documentKindCopy[
                              document.document_kind as keyof typeof documentKindCopy
                            ] ?? "Documento"}
                          </strong>
                          <p className="text-muted-foreground text-xs">
                            {partnerDocumentStatusCopy[document.status]} ·{" "}
                            {(document.size_bytes / 1024).toFixed(0)} KiB
                          </p>
                        </div>
                        <Button asChild size="sm" variant="outline">
                          <Link
                            href={`/operacion/marketplace/partners/${partner.id}/documentos/${document.id}`}
                            target="_blank"
                          >
                            Abrir de forma segura
                          </Link>
                        </Button>
                      </div>
                      {partner.status === "UNDER_REVIEW" ? (
                        <DocumentReviewForm
                          documentId={document.id}
                          version={document.version}
                        />
                      ) : (
                        <p className="text-muted-foreground mt-3 text-sm">
                          La revisión se habilita cuando el Partner envía su
                          solicitud.
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Sin documentos.</p>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Cambiar estado</CardTitle>
            </CardHeader>
            <CardContent>
              {transitions[partner.status].length ? (
                <PartnerStatusForm
                  partnerId={partner.id}
                  version={partner.version}
                  options={transitions[partner.status]}
                />
              ) : (
                <p className="text-muted-foreground text-sm">
                  No hay transiciones disponibles.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Historial</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                {result.history.map((entry) => (
                  <li key={entry.id} className="border-l-2 pl-4 text-sm">
                    <strong>{partnerStatusCopy[entry.to_status].label}</strong>
                    <p className="text-muted-foreground mt-1">
                      {new Intl.DateTimeFormat("es-MX", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(entry.created_at))}
                    </p>
                    {entry.reason ? (
                      <p className="mt-1">{entry.reason}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
