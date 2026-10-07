import Link from "next/link";
import { listBulkImportHistory } from "@/lib/bulk-import/service";

type HistoryRow = {
  id: string; import_type: "FIRST_PARTY" | "PARTNER"; source_filename: string;
  row_count: number; ready_count: number; warning_count: number; error_count: number;
  status: string; created_at: string;
};

const statusLabel: Record<string, string> = {
  UPLOADED: "Archivo recibido", PARSING: "Leyendo datos", NORMALIZING: "Normalizando", VALIDATING: "Validando datos", RESOLVING_CATALOG: "Resolviendo catálogo", RESOLVING_ASSETS: "Resolviendo fotos", ANALYZING_PRICING: "Analizando precios", READY_FOR_REVIEW: "Listo para revisar", FAILED: "Error", CANCELLED: "Cancelado",
};

export default async function BulkImportHistoryPage() {
  const jobs = (await listBulkImportHistory()) as HistoryRow[];
  return <div className="space-y-8"><div><Link className="text-sm underline" href="/operacion/carga-masiva">← Volver a carga masiva</Link><h1 className="text-pg-black mt-4 text-4xl font-semibold">Historial de cargas</h1></div><div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">Fecha</th><th className="p-3">Tipo</th><th className="p-3">Archivo</th><th className="p-3">Filas</th><th className="p-3">Listas</th><th className="p-3">Advertencias</th><th className="p-3">Errores</th><th className="p-3">Estado</th></tr></thead><tbody>{jobs.map((job) => <tr key={job.id} className="border-b"><td className="p-3">{new Date(job.created_at).toLocaleString("es-MX")}</td><td className="p-3">{job.import_type === "PARTNER" ? "Partner" : "Best Round"}</td><td className="p-3">{job.source_filename}</td><td className="p-3">{job.row_count}</td><td className="p-3">{job.ready_count}</td><td className="p-3">{job.warning_count}</td><td className="p-3">{job.error_count}</td><td className="p-3">{statusLabel[job.status] ?? "En revisión"}</td></tr>)}</tbody></table>{jobs.length === 0 ? <p className="p-8 text-center text-muted-foreground">Aún no hay cargas registradas.</p> : null}</div></div>;
}
