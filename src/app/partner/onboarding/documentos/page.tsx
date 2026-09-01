import Link from "next/link";
import { redirect } from "next/navigation";

import { DocumentUploadForm } from "@/components/marketplace/partner-forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentPartnerContext } from "@/lib/marketplace/partner-data";
import {
  documentKindCopy,
  isPartnerReadOnly,
} from "@/lib/marketplace/partner-rules";
import { requiredPartnerDocuments } from "@/lib/identity-verification/document-analysis";

export default async function PartnerDocumentsPage() {
  const { partner, documents, documentAnalyses } =
    await getCurrentPartnerContext();
  if (!partner) redirect("/partner/onboarding");
  if (isPartnerReadOnly(partner.status)) redirect("/partner/verificacion");
  const required = requiredPartnerDocuments({
    legalType: partner.legal_type,
    countryCode: partner.country_code,
  });
  const latestAnalysisByDocument = new Map<
    string,
    (typeof documentAnalyses)[number]
  >();
  for (const analysis of documentAnalyses) {
    if (!latestAnalysisByDocument.has(analysis.document_id)) {
      latestAnalysisByDocument.set(analysis.document_id, analysis);
    }
  }
  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <header>
        <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
          Paso 3 de 4 · Documentos
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Documentos</h1>
        <p className="text-muted-foreground mt-3">
          Agrega los documentos que corresponden a tu tipo de cuenta. Best Round
          revisará la evidencia antes de verificarte.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Documentos necesarios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {required.map((kind) => (
              <li key={kind}>{documentKindCopy[kind]}</li>
            ))}
          </ul>
          {partner.legal_type !== "INDIVIDUAL" ? (
            <Button asChild size="sm" variant="outline">
              <Link href="/partner/onboarding/fiscal">
                Completar datos fiscales
              </Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Carga privada</CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentUploadForm />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recibidos</CardTitle>
          </CardHeader>
          <CardContent>
            {documents.length ? (
              <ul className="space-y-3">
                {documents.map((document) => {
                  const analysis = latestAnalysisByDocument.get(document.id);
                  const csfMessage =
                    document.document_kind === "fiscal_certificate" && analysis
                      ? analysis.result === "PASSED"
                        ? "Constancia validada correctamente."
                        : analysis.result === "FAILED"
                          ? "Encontramos una diferencia entre tu información fiscal y la constancia. Revisa tus datos o vuelve a cargar el documento correcto."
                          : "No pudimos validar automáticamente toda la constancia. Best Round revisará este documento."
                      : null;
                  const addressMessage =
                    (document.document_kind === "address_proof" ||
                      document.document_kind === "company_address_proof") &&
                    analysis
                      ? analysis.result === "PASSED"
                        ? "Comprobante de domicilio validado correctamente."
                        : analysis.result === "FAILED"
                          ? "Encontramos una diferencia en el comprobante de domicilio. Revisa la información o carga un documento actualizado."
                          : "No pudimos validar automáticamente toda la información del comprobante. Best Round lo revisará."
                      : null;
                  return (
                    <li key={document.id} className="rounded-xl border p-3">
                      <strong className="text-sm">
                        {documentKindCopy[
                          document.document_kind as keyof typeof documentKindCopy
                        ] ?? "Documento"}
                      </strong>
                      <span className="text-muted-foreground mt-1 block text-xs">
                        {document.status === "REJECTED"
                          ? "Necesitamos que actualices este documento"
                          : document.status === "VERIFIED"
                            ? "Aprobado"
                            : "Recibido"}
                      </span>
                      {csfMessage ? (
                        <p className="mt-2 text-xs">{csfMessage}</p>
                      ) : null}
                      {addressMessage ? (
                        <p className="mt-2 text-xs">{addressMessage}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">
                Aún no hay documentos.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      <Button asChild variant="outline">
        <Link href="/partner/onboarding/revision">Continuar a revisión</Link>
      </Button>
    </div>
  );
}
