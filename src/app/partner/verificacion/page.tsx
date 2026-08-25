import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentPartnerContext } from "@/lib/marketplace/partner-data";
import {
  documentKindCopy,
  partnerDocumentStatusCopy,
  partnerStatusCopy,
} from "@/lib/marketplace/partner-rules";
import { redirect } from "next/navigation";

export default async function PartnerVerificationPage() {
  const { partner, documents } = await getCurrentPartnerContext();
  if (!partner) redirect("/partner/onboarding");
  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-4xl font-semibold">Verificación</h1>
        <p className="text-muted-foreground mt-3">
          {partnerStatusCopy[partner.status].description}
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>{partnerStatusCopy[partner.status].label}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {documents.length ? (
            <ul className="space-y-3">
              {documents.map((document) => (
                <li key={document.id} className="rounded-xl border p-4">
                  <strong>
                    {documentKindCopy[
                      document.document_kind as keyof typeof documentKindCopy
                    ] ?? "Documento"}
                  </strong>
                  <span className="text-muted-foreground ml-2 text-sm">
                    {partnerDocumentStatusCopy[document.status]}
                  </span>
                  {document.status === "REJECTED" ? (
                    <p className="text-destructive mt-2 text-sm">
                      Necesitamos que actualices este documento.
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              No hay documentos registrados.
            </p>
          )}
          {partner.status === "IDENTITY_PENDING" ? (
            <Button asChild>
              <Link href="/partner/onboarding/documentos">
                Actualizar información
              </Link>
            </Button>
          ) : null}
          {partner.status === "VERIFIED" ? (
            <p className="rounded-xl bg-black/5 p-4 text-sm">
              La publicación de productos estará disponible próximamente.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
