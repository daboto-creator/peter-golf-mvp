"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createBulkImportPreview } from "@/lib/bulk-import/service";

type PartnerOption = { id: string; label: string; status: string };
type State = Awaited<ReturnType<typeof createBulkImportPreview>> | null;

export function BulkImportForm({ partners }: { partners: PartnerOption[] }) {
  const [state, action, pending] = useActionState<State, FormData>(async (_previous, formData) => createBulkImportPreview(formData), null);
  const preview = state?.ok ? state.preview : null;
  const jobId = state?.ok ? state.jobId : null;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Subir CSV</CardTitle><CardDescription>La carga sólo prepara una vista previa. No crea productos, inventario ni publicaciones.</CardDescription></CardHeader>
        <CardContent>
          <form action={action} className="grid gap-5 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">Tipo de inventario
              <select name="importType" defaultValue="FIRST_PARTY" className="border-input h-11 rounded-xl border bg-background px-3">
                <option value="FIRST_PARTY">Inventario Best Round</option><option value="PARTNER">Inventario Partner</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">Archivo CSV
              <input required name="csv" type="file" accept=".csv,text/csv" className="border-input h-11 rounded-xl border bg-background px-3 py-2 text-sm" />
            </label>
            <label className="grid gap-2 text-sm font-medium">Partner (sólo publicaciones Partner)
              <select name="partnerProfileId" className="border-input h-11 rounded-xl border bg-background px-3">
                <option value="">Selecciona un Partner</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.label} · {partner.status}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">Carpeta de fotos (opcional)
              <input name="photoSourceReference" placeholder="URL de carpeta compartida" className="border-input h-11 rounded-xl border bg-background px-3" />
            </label>
            <label className="grid gap-2 text-sm font-medium">Fuente de fotos
              <select name="photoSourceType" defaultValue="" className="border-input h-11 rounded-xl border bg-background px-3"><option value="">Sin fuente todavía</option><option value="GOOGLE_DRIVE_SHARED_FOLDER">Carpeta compartida de Google Drive</option><option value="ZIP_UPLOAD">ZIP de fotos</option></select>
            </label>
            <div className="flex flex-wrap items-center gap-3 md:col-span-2"><Button type="submit" disabled={pending}>{pending ? "Validando datos…" : "Validar y preparar vista previa"}</Button><Button asChild variant="outline"><Link href="/operacion/carga-masiva/historial">Ver historial</Link></Button><a className="text-sm underline" href="/templates/plantilla_inventario_best_round.csv" download>Descargar plantilla Best Round</a><a className="text-sm underline" href="/templates/plantilla_publicaciones_partner.csv" download>Descargar plantilla Partner</a></div>
          </form>
          {state && !state.ok ? <p className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{state.message}</p> : null}
        </CardContent>
      </Card>
      {preview ? <Card><CardHeader><CardTitle>Vista previa lista para revisión</CardTitle><CardDescription>{preview.summary.total} filas · {preview.summary.ready} listas · {preview.summary.warnings} advertencias · {preview.summary.errors} errores</CardDescription></CardHeader><CardContent><div className="mb-4 flex gap-3"><a className="text-sm underline" href={jobId ? `/operacion/carga-masiva/${jobId}/errores.csv` : "#"} download>Descargar errores</a><Link className="text-sm underline" href="/operacion/carga-masiva/historial">Abrir historial</Link></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Estado</th><th className="p-2">ID externo</th><th className="p-2">Marca</th><th className="p-2">Modelo</th><th className="p-2">Año</th><th className="p-2">Precio</th><th className="p-2">Problema</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.rowNumber} className="border-b align-top"><td className="p-2 font-medium">{row.severity === "READY" ? "Lista" : row.severity === "WARNING" ? "Advertencia" : "Error"}</td><td className="p-2">{row.normalized.externalId ?? "—"}</td><td className="p-2">{row.normalized.brand ?? "—"}</td><td className="p-2">{row.normalized.model ?? "—"}</td><td className="p-2">{row.normalized.modelYear ?? "—"}</td><td className="p-2">{row.pricing.proposedPriceMinor === null ? "—" : `$${(row.pricing.proposedPriceMinor / 100).toFixed(2)}`}</td><td className="p-2">{row.issues.map((issue) => issue.message).join(" ") || "—"}</td></tr>)}</tbody></table></div><p className="mt-4 text-xs text-muted-foreground">Las normalizaciones conservan el valor original y el valor canónico para auditoría. Las filas con errores se pueden corregir o excluir en el siguiente flujo.</p></CardContent></Card> : null}
    </div>
  );
}
