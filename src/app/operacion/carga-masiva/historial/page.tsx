import Link from "next/link";
import { listBulkImportHistory } from "@/lib/bulk-import/service";
import { BulkImportDiscardForm } from "@/components/operations/bulk-import-discard-form";

type HistoryRow = {
  id: string; import_type: "FIRST_PARTY" | "PARTNER"; source_filename: string;
  row_count: number; ready_count: number; warning_count: number; error_count: number;
  status: string; created_at: string;
};

const statusLabel: Record<string, string> = {
  UPLOADED: "Archivo recibido", PARSING: "Leyendo datos", NORMALIZING: "Normalizando", VALIDATING: "Validando datos", RESOLVING_CATALOG: "Resolviendo catálogo", RESOLVING_ASSETS: "Resolviendo fotos", ANALYZING_PRICING: "Analizando precios", READY_FOR_REVIEW: "Listo para revisar", FAILED: "Error", CANCELLED: "Cancelado",
};

export default async function BulkImportHistoryPage({ searchParams }: { searchParams?: Promise<{ discarded?: string }> }) {
  const jobs = (await listBulkImportHistory()) as HistoryRow[];
  const params = await searchParams;
  return <div className="space-y-8"><div><Link className="text-sm underline" href="/operacion/carga-masiva">← Volver a carga masiva</Link><h1 className="text-pg-black mt-4 text-4xl font-semibold">Historial de cargas</h1>{params?.discarded === "1" ? <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">La carga fue descartada correctamente.</p> : null}</div><div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">Fecha</th><th className="p-3">Tipo</th><th className="p-3">Archivo</th><th className="p-3">Filas</th><th className="p-3">Listas</th><th className="p-3">Advertencias</th><th className="p-3">Errores</th><th className="p-3">Estado</th><th className="p-3">Acciones</th></tr></thead><tbody>{jobs.map((job) => <tr key={job.id} className="border-b"><td className="p-3">{new Date(job.created_at).toLocaleString("es-MX")}</td><td className="p-3">{job.import_type === "PARTNER" ? "Partner" : "Best Round"}</td><td className="p-3">{job.source_filename}</td><td className="p-3">{job.row_count}</td><td className="p-3">{job.ready_count}</td><td className="p-3">{job.warning_count}</td><td className="p-3">{job.error_count}</td><td className="p-3">{statusLabel[job.status] ?? "En revisión"}</td><td className="p-3"><BulkImportDiscardForm jobId={job.id} /></td></tr>)}</tbody></table>{jobs.length === 0 ? <div className="space-y-3 p-8 text-center text-muted-foreground"><p>No hay cargas masivas registradas.</p><Link className="inline-block underline" href="/operacion/carga-masiva">Nueva carga masiva</Link></div> : null}</div></div>;
}
