import { PackagePlus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listCurrentPartnerListings } from "@/lib/marketplace/listing-data";
import {
  getListingNextStep,
  isMarketplaceListingStatus,
  listingStatusCopy,
} from "@/lib/marketplace/listing-rules";
import { getPartnerPublicationStatus } from "@/lib/marketplace/publication-rules";
import { getCurrentPartnerContext } from "@/lib/marketplace/partner-data";

export default async function PartnerListingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { partner } = await getCurrentPartnerContext();
  if (!partner) redirect("/partner/onboarding");
  const params = await searchParams;
  const page = Math.max(
    1,
    Number(typeof params.page === "string" ? params.page : "1") || 1,
  );
  const status =
    typeof params.status === "string" &&
    isMarketplaceListingStatus(params.status)
      ? params.status
      : undefined;
  const result = await listCurrentPartnerListings(partner.id, page, status);
  const pages = Math.max(1, Math.ceil(result.count / result.pageSize));
  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
            Portal Partner
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em]">
            Publicaciones
          </h1>
          <p className="text-muted-foreground mt-3">
            Prepara productos y envíalos a revisión humana de Best Round.
          </p>
        </div>
        {partner.status === "VERIFIED" ? (
          <Button asChild>
            <Link href="/partner/publicaciones/nueva">
              <PackagePlus aria-hidden="true" />
              Publicar un producto
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link href="/partner/verificacion">Completar verificación</Link>
          </Button>
        )}
      </header>
      {partner.status !== "VERIFIED" ? (
        <Card className="border-pg-gold/40">
          <CardHeader>
            <CardTitle>Verificación requerida</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Conservas acceso de lectura a tu historial, pero sólo un Partner
              verificado puede crear o enviar publicaciones.
            </p>
          </CardContent>
        </Card>
      ) : null}
      <form className="flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row">
        <label className="sr-only" htmlFor="listing-status-filter">
          Estado
        </label>
        <select
          id="listing-status-filter"
          name="status"
          defaultValue={status ?? ""}
          className="border-input h-11 flex-1 rounded-xl border bg-white px-3 text-sm"
        >
          <option value="">Todos los estados</option>
          {Object.entries(listingStatusCopy).map(([key, copy]) => (
            <option key={key} value={key}>
              {copy.label}
            </option>
          ))}
        </select>
        <Button type="submit">Filtrar</Button>
      </form>
      {result.error ? (
        <p className="text-destructive rounded-xl border bg-white p-5">
          No pudimos cargar tus publicaciones.
        </p>
      ) : result.data.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {result.data.map((listing) => {
            const version = listing.currentVersion;
            const title =
              version?.title ||
              version?.catalog_product_models?.model_name ||
              version?.proposed_model ||
              "Publicación en preparación";
            return (
              <Card key={listing.id} className="overflow-hidden">
                {listing.primaryImage ? (
                  <div className="relative aspect-[4/3] bg-black/5">
                    <Image
                      src={listing.primaryImage.url}
                      alt={listing.primaryImage.alt}
                      fill
                      unoptimized
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                      className="object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center bg-black/5 text-sm text-black/45">
                    Agrega la primera foto
                  </div>
                )}
                <CardHeader>
                  <p className="text-pg-gold text-xs font-semibold uppercase">
                    {listing.publicationReadiness
                      ? getPartnerPublicationStatus({
                          listingStatus: listing.status,
                          publicationReady:
                            listing.publicationReadiness.publication_ready,
                          published: listing.publicationReadiness.published,
                          blockers: listing.publicationReadiness.blockers,
                        })
                      : listingStatusCopy[listing.status].label}
                  </p>
                  <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground text-sm">
                    Cantidad {version?.quantity ?? 1} · Actualizado{" "}
                    {new Intl.DateTimeFormat("es-MX").format(
                      new Date(listing.updated_at),
                    )}
                  </p>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/partner/publicaciones/${listing.id}`}>
                      {getListingNextStep(listing.status)}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-white p-10 text-center">
          <h2 className="font-semibold">Aún no hay publicaciones</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Comienza con una categoría y guarda el avance paso a paso.
          </p>
        </div>
      )}
      <nav
        aria-label="Paginación de publicaciones"
        className="flex items-center justify-between"
      >
        <Button asChild={page > 1} disabled={page <= 1} variant="outline">
          {page > 1 ? (
            <Link href={`?status=${status ?? ""}&page=${page - 1}`}>
              Anterior
            </Link>
          ) : (
            <span>Anterior</span>
          )}
        </Button>
        <span className="text-muted-foreground text-sm">
          Página {page} de {pages}
        </span>
        <Button
          asChild={page < pages}
          disabled={page >= pages}
          variant="outline"
        >
          {page < pages ? (
            <Link href={`?status=${status ?? ""}&page=${page + 1}`}>
              Siguiente
            </Link>
          ) : (
            <span>Siguiente</span>
          )}
        </Button>
      </nav>
    </div>
  );
}
