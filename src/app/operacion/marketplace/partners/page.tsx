import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requirePartnerManager } from "@/lib/auth/marketplace-authorization";
import { listPartnersForOperations } from "@/lib/marketplace/partner-data";
import {
  legalTypeCopy,
  isPartnerStatus,
  partnerStatusCopy,
} from "@/lib/marketplace/partner-rules";

export default async function PartnersOperationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePartnerManager("/operacion/marketplace/partners");
  const params = await searchParams;
  const page = Math.max(
    1,
    Number(typeof params.page === "string" ? params.page : "1") || 1,
  );
  const status =
    typeof params.status === "string" && isPartnerStatus(params.status)
      ? params.status
      : undefined;
  const result = await listPartnersForOperations(page, status);
  const pages = Math.max(1, Math.ceil(result.count / result.pageSize));
  return (
    <div className="space-y-8">
      <header>
        <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
          Marketplace
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Best Round Partners</h1>
        <p className="text-muted-foreground mt-3">
          Revisión privada de perfiles y documentos.
        </p>
      </header>
      <form className="flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row">
        <label className="sr-only" htmlFor="partner-status-filter">
          Estado
        </label>
        <select
          id="partner-status-filter"
          name="status"
          defaultValue={status ?? ""}
          className="border-input h-11 flex-1 rounded-xl border bg-white px-3 text-sm"
        >
          <option value="">Todos los estados</option>
          {Object.entries(partnerStatusCopy).map(([key, copy]) => (
            <option key={key} value={key}>
              {copy.label}
            </option>
          ))}
        </select>
        <Input type="hidden" name="page" value="1" />
        <Button type="submit">Filtrar</Button>
      </form>
      {result.error ? (
        <p className="text-destructive rounded-xl border bg-white p-5">
          No pudimos cargar Partners.
        </p>
      ) : result.data.length ? (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b bg-black/[0.03]">
              <tr>
                <th className="p-4">Partner</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Alta</th>
                <th className="p-4">Documentos pendientes</th>
                <th className="p-4">
                  <span className="sr-only">Acción</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((partner) => (
                <tr key={partner.id} className="border-b last:border-0">
                  <td className="p-4 font-medium">
                    {partner.commercial_name ||
                      [partner.first_name, partner.last_name]
                        .filter(Boolean)
                        .join(" ") ||
                      "Perfil por completar"}
                  </td>
                  <td className="p-4">
                    {legalTypeCopy[partner.legal_type].label}
                  </td>
                  <td className="p-4">
                    {partnerStatusCopy[partner.status].label}
                  </td>
                  <td className="p-4">
                    {new Intl.DateTimeFormat("es-MX").format(
                      new Date(partner.created_at),
                    )}
                  </td>
                  <td className="p-4">
                    {
                      partner.partner_documents.filter((document) =>
                        ["UPLOADED", "UNDER_REVIEW", "REJECTED"].includes(
                          document.status,
                        ),
                      ).length
                    }
                  </td>
                  <td className="p-4">
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={`/operacion/marketplace/partners/${partner.id}`}
                      >
                        Revisar
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed bg-white p-10 text-center">
          No hay Partners con estos filtros.
        </p>
      )}
      <nav
        aria-label="Paginación de Partners"
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
