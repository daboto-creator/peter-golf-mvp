import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  ListingReviewDecisionForm,
  ResolveListingProductForm,
} from "@/components/marketplace/listing-forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireListingManager } from "@/lib/auth/marketplace-authorization";
import {
  getMarketplaceListingForOperations,
  getMarketplaceListingTaxonomy,
} from "@/lib/marketplace/listing-data";
import {
  listingStatusCopy,
  reviewAreaCopy,
} from "@/lib/marketplace/listing-rules";

const reviewOptions = {
  SUBMITTED: [{ value: "UNDER_REVIEW" as const, label: "Tomar para revisión" }],
  UNDER_REVIEW: [
    { value: "CHANGES_REQUESTED" as const, label: "Solicitar cambios" },
    { value: "APPROVED" as const, label: "Aprobar" },
    { value: "REJECTED" as const, label: "Rechazar" },
  ],
};

export default async function MarketplaceListingOperationsDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireListingManager(`/operacion/marketplace/publicaciones/${id}`);
  const detail = await getMarketplaceListingForOperations(id);
  if (!detail.listing || !detail.version || !detail.partner || detail.error)
    notFound();
  const taxonomy = await getMarketplaceListingTaxonomy(
    detail.version.category_id,
  );
  const options =
    detail.listing.status === "SUBMITTED" ||
    detail.listing.status === "UNDER_REVIEW"
      ? reviewOptions[detail.listing.status]
      : [];
  const partnerName =
    detail.partner.commercial_name ||
    [detail.partner.first_name, detail.partner.last_name]
      .filter(Boolean)
      .join(" ") ||
    "Partner";
  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
            Revisión Marketplace · Versión {detail.version.version_number}
          </p>
          <h1 className="mt-3 text-4xl font-semibold">
            {detail.version.title ?? "Publicación Partner"}
          </h1>
          <p className="text-muted-foreground mt-3">
            {partnerName} · {listingStatusCopy[detail.listing.status].label}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/operacion/marketplace/publicaciones">
            Volver a la cola
          </Link>
        </Button>
      </header>
      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Producto e identidad</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <p>
                <strong>Categoría:</strong> {detail.version.categories?.name}
              </p>
              <p>
                <strong>Marca:</strong>{" "}
                {detail.version.brands?.name ??
                  detail.version.proposed_brand ??
                  "Por resolver"}
              </p>
              <p>
                <strong>Modelo propuesto:</strong>{" "}
                {detail.version.proposed_model ?? "—"}
              </p>
              <p>
                <strong>Modelo canónico:</strong>{" "}
                {detail.version.catalog_product_models?.model_name ??
                  "Pendiente"}
              </p>
              <p>
                <strong>Partner:</strong> {partnerName}
              </p>
              <p>
                <strong>Ubicación:</strong>{" "}
                {[detail.partner.city, detail.partner.state]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Fotografías privadas de revisión</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {detail.images.length ? (
                detail.images.map((image) => (
                  <article
                    key={image.image_id}
                    className="overflow-hidden rounded-xl border"
                  >
                    {image.signedUrl ? (
                      <div className="relative aspect-[4/3] bg-black/5">
                        <Image
                          src={image.signedUrl}
                          alt={image.alt_text}
                          fill
                          unoptimized
                          sizes="(max-width: 640px) 100vw, 33vw"
                          className="object-contain"
                        />
                      </div>
                    ) : null}
                    <div className="p-3 text-sm">
                      <strong className="capitalize">
                        {image.image_type.replaceAll("_", " ")}
                      </strong>
                      <p className="text-muted-foreground text-xs">
                        {image.requirement}
                        {image.is_sensitive ? " · Privada" : ""}
                      </p>
                    </div>
                  </article>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">Sin fotos.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Condición y declaración</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>
                <strong>Condición:</strong> {detail.version.condition ?? "—"}{" "}
                {detail.version.condition_grade
                  ? `· ${detail.version.condition_grade}`
                  : ""}
              </p>
              <p className="whitespace-pre-wrap">
                {detail.version.condition_notes ?? "Sin notas."}
              </p>
              <div>
                <strong>Defectos declarados</strong>
                <pre className="mt-2 overflow-x-auto rounded-xl bg-black/5 p-3 font-sans text-sm whitespace-pre-wrap">
                  {JSON.stringify(detail.version.declared_defects, null, 2)}
                </pre>
              </div>
              <p>
                <strong>Declaración confirmada:</strong>{" "}
                {detail.version.defects_acknowledged ? "Sí" : "No"}
              </p>
              <p>
                <strong>Serial privado:</strong>{" "}
                {detail.version.serial_number_private ?? "No declarado"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Especificaciones e inventario</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <pre className="overflow-x-auto rounded-xl bg-black/5 p-3 font-sans text-sm whitespace-pre-wrap">
                {JSON.stringify(detail.version.specifications, null, 2)}
              </pre>
              <p>
                <strong>Cantidad:</strong> {detail.version.quantity}
              </p>
              <p>
                <strong>Disponible:</strong>{" "}
                {detail.inventory?.quantity_available}
              </p>
              <p>
                <strong>Ownership:</strong> {detail.version.ownership}
              </p>
              <p>
                <strong>Custody:</strong> {detail.version.custody}
              </p>
              <p>
                <strong>Fulfillment:</strong> {detail.version.fulfillment}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Comentarios de revisión</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.feedback.length ? (
                <ul className="space-y-3">
                  {detail.feedback.map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-xl border p-4 text-sm"
                    >
                      <strong>
                        {reviewAreaCopy[entry.area]} ·{" "}
                        {entry.visibility === "INTERNAL"
                          ? "Interno"
                          : "Visible al Partner"}
                      </strong>
                      <p className="mt-1">{entry.comment}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Sin comentarios.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          {(detail.listing.status === "SUBMITTED" ||
            detail.listing.status === "UNDER_REVIEW") &&
          !detail.version.canonical_model_id ? (
            <Card>
              <CardHeader>
                <CardTitle>Resolver producto canónico</CardTitle>
              </CardHeader>
              <CardContent>
                <ResolveListingProductForm
                  listingId={id}
                  lockVersion={detail.listing.lock_version}
                  brands={taxonomy.brands}
                  models={detail.models}
                />
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Decisión humana</CardTitle>
            </CardHeader>
            <CardContent>
              {options.length ? (
                <ListingReviewDecisionForm
                  listingId={id}
                  lockVersion={detail.listing.lock_version}
                  options={options}
                />
              ) : (
                <p className="text-muted-foreground text-sm">
                  No hay acciones para este estado.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Readiness técnico</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{detail.readiness?.ready ? "Completo" : "Incompleto"}</p>
              {(detail.readiness?.missing_fields ?? []).map((field) => (
                <p key={field}>• {field}</p>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Historial inmutable</CardTitle>
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
    </div>
  );
}
