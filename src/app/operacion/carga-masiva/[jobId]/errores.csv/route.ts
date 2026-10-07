import { getBulkImportJob } from "@/lib/bulk-import/service";
import { exportErrorCsv } from "@/lib/bulk-import/csv";

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const result = await getBulkImportJob(jobId);
  const rows = result.rows.filter((row: { severity: string }) => row.severity === "ERROR" || row.severity === "WARNING").map((row: { row_number: number; external_id: string | null; severity: string; validation_result: { issues?: Array<{ code?: string; message?: string }> } }) => ({
    Fila: row.row_number,
    "ID externo": row.external_id,
    Estado: row.severity,
    Código: row.validation_result?.issues?.[0]?.code ?? "REVISION",
    Problema: row.validation_result?.issues?.[0]?.message ?? "Revisa esta fila.",
  }));
  return new Response(exportErrorCsv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="errores-${jobId}.csv"` } });
}
