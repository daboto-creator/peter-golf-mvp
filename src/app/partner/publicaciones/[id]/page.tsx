import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMarketplaceListingDetail } from "@/lib/marketplace/listing-data";
import {
  listingStatusCopy,
  partnerEditableListingStatuses,
  reviewAreaCopy,
} from "@/lib/marketplace/listing-rules";

export default async function PartnerListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getMarketplaceListingDetail(id);
  if (!detail.listing || !detail.version || detail.error) notFound();
  const { listing, version } = detail;
  const visibleFeedback = detail.feedback.filter(
    (entry) =>
      entry.visibility === "PARTNER_VISIBLE" && entry.status === "OPEN",
  );
  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
            {listingStatusCopy[listing.status].label} · Versión{" "}
            {version.version_number}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em]">
            {version.title ?? "Publicación en preparación"}
          </h1>
          <p className="text-muted-foreground mt-3">
            {listingStatusCopy[listing.status].description}
          </p>
        </div>
        {partnerEditableListingStatuses.has(listing.status) ? (
          <Button asChild>
            <Link href={`/partner/publicaciones/${id}/producto`}>
              Continuar edición
            </Link>
          </Button>
        ) : listing.status === "APPROVED" ? (
          <Button asChild>
            <Link href={`/partner/publicaciones/${id}/precio`}>
              Preparar precio
            </Link>
          </Button>
        ) : null}
      </header>
      {visibleFeedback.length ? (
        <Card className="border-pg-gold/50">
          <CardHeader>
            <CardTitle>Necesitamos que actualices información</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {visibleFeedback.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-xl border bg-white p-4 text-sm"
                >
                  <strong>{reviewAreaCopy[entry.area]}</strong>
                  <p className="mt-1">{entry.comment}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Resumen enviado</CardTitle>
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
              {version.description ?? "Sin descripción."}
            </p>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Datos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                <strong>Categoría:</strong> {version.categories?.name}
              </p>
              <p>
                <strong>Condición:</strong>{" "}
                {version.condition === "new" ? "Nuevo" : "Usado"}
              </p>
              <p>
                <strong>Cantidad:</strong> {version.quantity}
              </p>
              <p>
                <strong>Propiedad:</strong> Partner
              </p>
              <p>
                <strong>Disponible:</strong>{" "}
                {detail.inventory?.quantity_available ?? version.quantity}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Historial</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                {detail.history.map((entry) => (
                  <li key={entry.id} className="border-l-2 pl-4 text-sm">
                    <strong>{listingStatusCopy[entry.to_status].label}</strong>
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
      <Button asChild variant="outline">
        <Link href="/partner/publicaciones">Volver a publicaciones</Link>
      </Button>
    </div>
  );
}
