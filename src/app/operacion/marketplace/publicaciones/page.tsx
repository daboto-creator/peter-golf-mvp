import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireListingManager } from "@/lib/auth/marketplace-authorization";
import {
  getMarketplaceListingTaxonomy,
  listMarketplaceListingsForOperations,
} from "@/lib/marketplace/listing-data";
import {
  isMarketplaceListingStatus,
  listingStatusCopy,
} from "@/lib/marketplace/listing-rules";
import { mapPublicationBlockers } from "@/lib/marketplace/publication-rules";

export default async function MarketplaceListingsOperationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireListingManager("/operacion/marketplace/publicaciones");
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
  const categoryId =
    typeof params.category === "string" ? params.category : undefined;
  const partnerId =
    typeof params.partner === "string" && /^[0-9a-f-]{36}$/.test(params.partner)
      ? params.partner
      : undefined;
  const dateFrom =
    typeof params.desde === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.desde)
      ? params.desde
      : undefined;
  const [result, taxonomy] = await Promise.all([
    listMarketplaceListingsForOperations(page, {
      status,
      categoryId,
      partnerId,
      dateFrom,
    }),
    getMarketplaceListingTaxonomy(),
  ]);
  const pages = Math.max(1, Math.ceil(result.count / result.pageSize));
  const filterQuery = new URLSearchParams({
    status: status ?? "",
    category: categoryId ?? "",
    partner: partnerId ?? "",
    desde: dateFrom ?? "",
  });
  return (
    <div className="space-y-8">
      <header>
        <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
          Marketplace
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Publicaciones Partner</h1>
        <p className="text-muted-foreground mt-3">
          Cola privada de revisión. Aprobado todavía no significa publicado.
        </p>
      </header>
      <form className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-2 xl:grid-cols-5">
        <label className="sr-only" htmlFor="listing-status-filter">
          Estado
        </label>
        <select
          id="listing-status-filter"
          name="status"
          defaultValue={status ?? ""}
          className="border-input h-11 rounded-xl border bg-white px-3 text-sm"
        >
          <option value="">Todos los estados</option>
          {Object.entries(listingStatusCopy).map(([key, copy]) => (
            <option key={key} value={key}>
              {copy.label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="listing-category-filter">
          Categoría
        </label>
        <select
          id="listing-category-filter"
          name="category"
          defaultValue={categoryId ?? ""}
          className="border-input h-11 rounded-xl border bg-white px-3 text-sm"
        >
          <option value="">Todas las categorías</option>
          {taxonomy.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <Input
          name="partner"
          aria-label="ID de Partner"
          placeholder="ID de Partner"
          defaultValue={partnerId ?? ""}
        />
        <Input
          name="desde"
          aria-label="Fecha desde"
          type="date"
          defaultValue={dateFrom ?? ""}
        />
        <Button type="submit">Filtrar</Button>
      </form>
      {result.error ? (
        <p className="text-destructive rounded-xl border bg-white p-5">
          No pudimos cargar la cola.
        </p>
      ) : result.data.length ? (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b bg-black/[0.03]">
              <tr>
                <th className="p-4">Publicación</th>
                <th className="p-4">Partner</th>
                <th className="p-4">Categoría</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Publicación</th>
                <th className="p-4">Versión</th>
                <th className="p-4">Actualización</th>
                <th className="p-4">
                  <span className="sr-only">Acción</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((listing) => {
                const partner = listing.partner_profiles;
                const version = listing.currentVersion;
                return (
                  <tr key={listing.id} className="border-b last:border-0">
                    <td className="p-4 font-medium">
                      {version?.title ?? version?.proposed_model ?? "Borrador"}
                    </td>
                    <td className="p-4">
                      {partner?.commercial_name ||
                        [partner?.first_name, partner?.last_name]
                          .filter(Boolean)
                          .join(" ") ||
                        "Partner"}
                    </td>
                    <td className="p-4">{version?.categories?.name ?? "—"}</td>
                    <td className="p-4">
                      {listingStatusCopy[listing.status].label}
                    </td>
                    <td className="p-4">
                      <p className="font-semibold">
                        {listing.publicationReadiness?.published
                          ? "PUBLICATION_READY · PUBLICADO"
                          : listing.publicationReadiness?.publication_ready
                            ? "PUBLICATION_READY"
                            : "BLOCKED"}
                      </p>
                      {listing.publicationReadiness?.blockers.length ? (
                        <ul className="text-muted-foreground mt-1 max-w-xs list-disc pl-4 text-xs">
                          {mapPublicationBlockers(
                            listing.publicationReadiness.blockers,
                          ).map((blocker) => (
                            <li key={blocker}>{blocker}</li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                    <td className="p-4">{version?.version_number ?? "—"}</td>
                    <td className="p-4">
                      {new Intl.DateTimeFormat("es-MX").format(
                        new Date(listing.updated_at),
                      )}
                    </td>
                    <td className="p-4">
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={`/operacion/marketplace/publicaciones/${listing.id}`}
                        >
                          Revisar
                        </Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed bg-white p-10 text-center">
          No hay publicaciones con estos filtros.
        </p>
      )}
      <nav
        aria-label="Paginación de publicaciones Partner"
        className="flex items-center justify-between"
      >
        <Button asChild={page > 1} disabled={page <= 1} variant="outline">
          {page > 1 ? (
            <Link href={`?${filterQuery.toString()}&page=${page - 1}`}>
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
            <Link href={`?${filterQuery.toString()}&page=${page + 1}`}>
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
