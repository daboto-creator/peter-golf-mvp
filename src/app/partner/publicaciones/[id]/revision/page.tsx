import Image from "next/image";
import Link from "next/link";

import { SubmitListingForm } from "@/components/marketplace/listing-forms";
import { ListingWizardHeader } from "@/components/marketplace/listing-wizard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireEditableListingPage } from "@/lib/marketplace/listing-page";

const readinessCopy: Record<string, string> = {
  product_identity: "Identidad del producto",
  specifications: "Especificaciones requeridas",
  condition: "Condición y grado",
  photos: "Fotos requeridas",
  quantity: "Cantidad válida",
  defects_acknowledgement: "Declaración de defectos",
  title: "Título",
  description: "Descripción",
};

export default async function ListingReviewStep({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await requireEditableListingPage(id);
  const missing = detail.readiness?.missing_fields ?? [];
  const ready = detail.readiness?.ready === true;
  return (
    <div className="space-y-8">
      <ListingWizardHeader
        listingId={id}
        current="revision"
        title="Revisa antes de enviar"
      />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>{detail.version.title ?? "Publicación"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {detail.images
                .filter((image) => !image.is_sensitive && image.signedUrl)
                .map((image) => (
                  <div
                    key={image.image_id}
                    className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black/5"
                  >
                    <Image
                      src={image.signedUrl!}
                      alt={image.alt_text}
                      fill
                      unoptimized
                      sizes="(max-width: 1024px) 50vw, 33vw"
                      className="object-contain"
                    />
                  </div>
                ))}
            </div>
            <p className="text-sm leading-6 whitespace-pre-wrap">
              {detail.version.description}
            </p>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Categoría</dt>
                <dd className="font-medium">
                  {detail.version.categories?.name}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Cantidad</dt>
                <dd className="font-medium">{detail.version.quantity}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Condición</dt>
                <dd className="font-medium">
                  {detail.version.condition === "new" ? "Nuevo" : "Usado"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Versión</dt>
                <dd className="font-medium">{detail.version.version_number}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <Card className={ready ? "border-pg-gold/50" : undefined}>
          <CardHeader>
            <CardTitle>
              {ready ? "Lista para revisión" : "Puntos pendientes"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {missing.length ? (
              <ul className="space-y-2 text-sm">
                {missing.map((entry) => (
                  <li key={entry}>• {readinessCopy[entry] ?? entry}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">
                Best Round revisará esta versión específica. Enviarla no la hace
                pública ni comprable.
              </p>
            )}
            <SubmitListingForm
              listingId={id}
              lockVersion={detail.listing.lock_version}
              ready={ready}
            />
            {!ready ? (
              <Button asChild variant="outline" className="w-full">
                <Link href={`/partner/publicaciones/${id}/producto`}>
                  Completar publicación
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
