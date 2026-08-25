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

export default async function PartnerDocumentsPage() {
  const { partner, documents } = await getCurrentPartnerContext();
  if (!partner) redirect("/partner/onboarding");
  if (isPartnerReadOnly(partner.status)) redirect("/partner/verificacion");
  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <header>
        <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
          Paso 4 de 5
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Documentos</h1>
        <p className="text-muted-foreground mt-3">
          Sube al menos un documento para iniciar la revisión. Los requisitos
          legales definitivos se confirmarán posteriormente.
        </p>
      </header>
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
                {documents.map((document) => (
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
                  </li>
                ))}
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
