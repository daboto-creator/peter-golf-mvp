"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createBulkImportPreview } from "@/lib/bulk-import/service";
import { bulkPhotoSourceCopy } from "@/lib/bulk-import/photo-copy";

type PartnerOption = { id: string; label: string; status: string };
type State = Awaited<ReturnType<typeof createBulkImportPreview>> | null;

export function BulkImportForm({ partners }: { partners: PartnerOption[] }) {
  const [photoSourceType, setPhotoSourceType] = useState<"" | "GOOGLE_DRIVE_SHARED_FOLDER" | "ZIP_UPLOAD">("");
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
            <fieldset className="grid gap-4 rounded-xl border bg-muted/20 p-4 md:col-span-2"><legend className="px-1 text-base font-semibold">{bulkPhotoSourceCopy.title}</legend><p className="text-sm text-muted-foreground">{bulkPhotoSourceCopy.description}</p><div className="grid gap-3 md:grid-cols-2"><label className="flex items-center gap-2 text-sm font-medium"><input type="radio" name="photoSourceType" value="GOOGLE_DRIVE_SHARED_FOLDER" checked={photoSourceType === "GOOGLE_DRIVE_SHARED_FOLDER"} onChange={() => setPhotoSourceType("GOOGLE_DRIVE_SHARED_FOLDER")} />{bulkPhotoSourceCopy.driveLabel}</label><label className="flex items-center gap-2 text-sm font-medium"><input type="radio" name="photoSourceType" value="ZIP_UPLOAD" checked={photoSourceType === "ZIP_UPLOAD"} onChange={() => setPhotoSourceType("ZIP_UPLOAD")} />{bulkPhotoSourceCopy.zipLabel}</label></div>{photoSourceType === "GOOGLE_DRIVE_SHARED_FOLDER" ? <label className="grid gap-2 text-sm font-medium">{bulkPhotoSourceCopy.driveField}<input required name="photoSourceReference" placeholder={bulkPhotoSourceCopy.drivePlaceholder} className="border-input h-11 rounded-xl border bg-background px-3" /><span className="text-xs font-normal text-muted-foreground">{bulkPhotoSourceCopy.driveHelp}</span></label> : null}{photoSourceType === "ZIP_UPLOAD" ? <label className="grid gap-2 text-sm font-medium">{bulkPhotoSourceCopy.zipLabel}<input name="photoZip" type="file" accept=".zip,application/zip" className="border-input h-11 rounded-xl border bg-background px-3 py-2 text-sm" /><span className="text-xs font-normal text-muted-foreground">{bulkPhotoSourceCopy.zipHelp}</span></label> : null}<div className="rounded-lg border bg-background p-3 text-xs"><p className="font-semibold">{bulkPhotoSourceCopy.keyTitle}</p><p>{bulkPhotoSourceCopy.keyHelp}</p><p className="mt-1">{bulkPhotoSourceCopy.keyExample}</p><p className="mt-1 text-muted-foreground">{bulkPhotoSourceCopy.keyNormalization}</p><p className="mt-1 font-medium">{bulkPhotoSourceCopy.driveOutsideCsv}</p></div></fieldset>
            <div className="flex flex-wrap items-center gap-3 md:col-span-2"><Button type="submit" disabled={pending}>{pending ? "Validando datos…" : "Validar y preparar vista previa"}</Button><Button asChild variant="outline"><Link href="/operacion/carga-masiva/historial">Ver historial</Link></Button><a className="text-sm underline" href="/templates/plantilla_inventario_best_round.csv" download>Descargar plantilla Best Round</a><a className="text-sm underline" href="/templates/plantilla_publicaciones_partner.csv" download>Descargar plantilla Partner</a></div>
          </form>
          {state && !state.ok ? <p className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{state.message}</p> : null}
        </CardContent>
      </Card>
      {preview ? <Card><CardHeader><CardTitle>Vista previa lista para revisión</CardTitle><CardDescription>{preview.summary.total} filas · {preview.summary.ready} listas · {preview.summary.warnings} advertencias · {preview.summary.errors} errores</CardDescription></CardHeader><CardContent><div className="mb-4 flex gap-3"><a className="text-sm underline" href={jobId ? `/operacion/carga-masiva/${jobId}/errores.csv` : "#"} download>Descargar errores</a><Link className="text-sm underline" href="/operacion/carga-masiva/historial">Abrir historial</Link></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Estado</th><th className="p-2">ID externo</th><th className="p-2">Marca</th><th className="p-2">Modelo</th><th className="p-2">Año</th><th className="p-2">Precio</th><th className="p-2">Problema</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.rowNumber} className="border-b align-top"><td className="p-2 font-medium">{row.severity === "READY" ? "Lista" : row.severity === "WARNING" ? "Advertencia" : "Error"}</td><td className="p-2">{row.normalized.externalId ?? "—"}</td><td className="p-2">{row.normalized.brand ?? "—"}</td><td className="p-2">{row.normalized.model ?? "—"}</td><td className="p-2">{row.normalized.modelYear ?? "—"}</td><td className="p-2">{row.pricing.proposedPriceMinor === null ? "—" : `$${(row.pricing.proposedPriceMinor / 100).toFixed(2)}`}</td><td className="p-2">{row.issues.map((issue) => issue.message).join(" ") || "—"}</td></tr>)}</tbody></table></div><p className="mt-4 text-xs text-muted-foreground">Las normalizaciones conservan el valor original y el valor canónico para auditoría. Las filas con errores se pueden corregir o excluir en el siguiente flujo.</p></CardContent></Card> : null}
    </div>
  );
}
