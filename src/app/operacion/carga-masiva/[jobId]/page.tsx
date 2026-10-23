import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BulkImportCanonicalYearAction,
  BulkImportEditRowForm,
  BulkImportExecutionAction,
  BulkImportPartnerExecutionAction,
  BulkImportManualFallbackForm,
  BulkImportReviewAction,
} from "@/components/operations/bulk-import-review-actions";
import { BulkImportDiscardForm } from "@/components/operations/bulk-import-discard-form";
import { getBulkImportJob } from "@/lib/bulk-import/service";
import {
  getFirstPartyBulkPricingReadiness,
  getPartnerBulkPricingReadiness,
  hasCanonicalModelYearMismatch,
  getDisplayedReviewedPriceMinor,
} from "@/lib/bulk-import/review-policy";
import { reconcileCurrentRowState } from "@/lib/bulk-import/review-reconciliation";
import { canEditBulkRow, isBulkRowRetryReady } from "@/lib/bulk-import/row-execution-policy";

type ReviewRow = {
  id: string;
  row_number: number;
  external_id: string | null;
  severity: string;
  excluded?: boolean;
  normalization_accepted?: boolean;
  execution_status?: string;
  execution_error?: string | null;
  canonical_model_id: string | null;
  canonical_model_year?: number | null;
  marketplace_listing_id?: string | null;
  marketplace_listing_version_id?: string | null;
  marketplace_inventory_id?: string | null;
  original_payload: Record<string, unknown>;
  normalized_payload: Record<string, unknown>;
  normalization_metadata: Record<string, unknown>;
  manual_resolution?: Record<string, unknown> | null;
  validation_result: {
    issues?: Array<{
      code: string;
      severity: "ERROR" | "WARNING" | "INFO";
      message: string;
    }>;
    modelCandidates?: Array<{
      id: string;
      name: string;
      modelYear: number | null;
    }>;
  };
  pricing_result: Record<string, unknown>;
  photo_metadata: Record<string, string | null>;
};

function jsonValue(value: unknown) {
  if (!value || typeof value !== "object") return "—";
  return (
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== null && item !== "")
      .map(
        ([key, item]) =>
          `${key}: ${typeof item === "object" ? JSON.stringify(item) : String(item)}`,
      )
      .join(" · ") || "—"
  );
}
function categoryLabel(value: unknown) {
  const labels: Record<string, string> = {
    driver: "Driver",
    "fairway-wood": "Madera de calle",
    hybrid: "Híbrido",
    iron: "Hierros",
    wedge: "Wedges",
    putter: "Putter",
  };
  return labels[String(value ?? "")] ?? (value ? String(value) : "—");
}

export default async function BulkImportReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams?: Promise<{ filtro?: string }>;
}) {
  const { jobId } = await params;
  const filter = (await searchParams)?.filtro ?? "todas";
  const { job, rows } = await getBulkImportJob(jobId);
  if (!job) notFound();
  const reviewRows = rows as ReviewRow[];
  const included = reviewRows.filter((row) => !row.excluded);
  const excluded = reviewRows.filter((row) => row.excluded);
  const currentStates = new Map(
    reviewRows.map((row) => {
      const state = reconcileCurrentRowState({
        importType: job.import_type,
        normalizedPayload: row.normalized_payload,
        pricingResult: row.pricing_result,
        existingIssues: row.validation_result?.issues ?? [],
        canonicalModelYear: row.canonical_model_year,
        manualResolution: row.manual_resolution,
      });
      return [row.id, state] as const;
    }),
  );
  const importedRows = reviewRows.filter((row) => row.execution_status === "IMPORTED");
  const skippedRows = reviewRows.filter((row) => row.execution_status === "SKIPPED_EXISTING");
  const errors = included.filter((row) => row.execution_status !== "IMPORTED" && row.execution_status !== "SKIPPED_EXISTING" && currentStates.get(row.id)?.severity === "ERROR");
  const warnings = included.filter(
    (row) => row.execution_status !== "IMPORTED" && row.execution_status !== "SKIPPED_EXISTING" && currentStates.get(row.id)?.severity === "WARNING",
  );
  const pricingReview = included.filter(
    (row) =>
      row.execution_status !== "IMPORTED" &&
      row.execution_status !== "SKIPPED_EXISTING" &&
      !(
        job.import_type === "FIRST_PARTY"
          ? getFirstPartyBulkPricingReadiness({
              normalized_payload: row.normalized_payload,
              pricing_result: row.pricing_result,
            })
          : getPartnerBulkPricingReadiness({
              normalized_payload: row.normalized_payload,
              pricing_result: row.pricing_result,
            })
      ).ready,
  ).length;
  const approved = job.status === "APPROVED_FOR_IMPORT";
  const imported = ["IMPORTED", "PARTIALLY_IMPORTED", "FAILED_IMPORT"].includes(job.status);
  const reviewable = job.status === "READY_FOR_REVIEW";
  const failedRows = reviewRows.filter((row) => row.execution_status === "FAILED");
  const retryReadyRows = failedRows.filter((row) => isBulkRowRetryReady({ jobStatus: job.status, executionStatus: row.execution_status, excluded: row.excluded, importType: job.import_type, normalizedPayload: row.normalized_payload, pricingResult: row.pricing_result, existingIssues: row.validation_result?.issues ?? [], canonicalModelYear: row.canonical_model_year, manualResolution: row.manual_resolution }));
  const attention = included.filter((row) => row.execution_status !== "IMPORTED" && row.execution_status !== "SKIPPED_EXISTING" && currentStates.get(row.id)?.severity !== "READY").length;
  const filteredRows = reviewRows.filter((row) => {
    const state = currentStates.get(row.id);
    return (
      filter === "todas" ||
      (filter === "listas" && !row.excluded && state?.severity === "READY") ||
      (filter === "importadas" && row.execution_status === "IMPORTED") ||
      (filter === "pendientes" && !row.excluded && row.execution_status !== "IMPORTED" && row.execution_status !== "SKIPPED_EXISTING") ||
      (filter === "reintentar" && retryReadyRows.some((candidate) => candidate.id === row.id)) ||
      (filter === "advertencias" &&
        !row.excluded &&
        state?.severity === "WARNING") ||
      (filter === "errores" && !row.excluded && state?.severity === "ERROR") ||
      (filter === "excluidas" && row.excluded) ||
      (filter === "atencion" && !row.excluded && state?.severity !== "READY")
    );
  });
  return (
    <div className="space-y-7">
      <div>
        <Link
          className="text-sm underline"
          href="/operacion/carga-masiva/historial"
        >
          ← Historial de cargas
        </Link>
        <h1 className="mt-4 text-4xl font-semibold">Carga masiva</h1>
        <p className="text-muted-foreground mt-2">
          {job.import_type === "PARTNER"
            ? "Inventario Partner"
            : "Inventario Best Round"}{" "}
          · {job.source_filename}
        </p>
        <p className="text-sm">
          Estado:{" "}
          <strong>
            {approved
              ? "Aprobada para importar"
              : imported
                ? job.status === "FAILED_IMPORT"
                  ? "Importación fallida"
                  : job.status === "IMPORTED"
                  ? "Importación completada"
                  : "Importación parcial"
                : "Lista para revisar"}
          </strong>
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {[
          ["Total filas", reviewRows.length, ""],
          [
            "Listas",
            included.filter(
              (row) => currentStates.get(row.id)?.severity === "READY",
            ).length,
            "border-emerald-200 bg-emerald-50",
          ],
          ["Revisión de precio", pricingReview, ""],
          ["Advertencias", warnings.length, "border-amber-200 bg-amber-50"],
          ["Errores", errors.length, "border-red-200 bg-red-50"],
          ["Excluidas", excluded.length, "border-muted bg-muted/30"],
          ["Requieren atención", attention, ""],
        ].map(([label, value, tone]) => (
          <div
            key={String(label)}
            className={`rounded-xl border bg-white p-4 ${tone}`}
          >
            <p className="text-muted-foreground text-xs">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <div className="bg-muted/20 rounded-xl border p-4 text-sm">
        <p className="font-semibold">Flujo siguiente</p>
        {job.import_type === "PARTNER" ? (
          <p>
            Carga → Revisión → Aprobada para importar → Crear borradores de
            publicaciones → Revisión comercial y de precio → Aprobación →
            Publicación. La carga nunca publica automáticamente.
          </p>
        ) : (
          <p>
            {imported
              ? "Importación ejecutada. Los resultados quedan disponibles para auditoría."
              : "Carga → Revisión → Aprobada para importar → Crear productos e inventario Best Round."}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          ["todas", "Todas"],
          ["importadas", "Importadas"],
          ["pendientes", "Pendientes"],
          ["reintentar", "Listas para reintentar"],
          ["listas", "Listas"],
          ["advertencias", "Advertencias"],
          ["errores", "Errores"],
          ["excluidas", "Excluidas"],
          ["atencion", "Requieren atención"],
        ].map(([value, label]) => (
          <Link
            key={value}
            className={`rounded-lg border px-3 py-2 text-sm ${filter === value ? "bg-primary text-primary-foreground" : "bg-background"}`}
            href={`/operacion/carga-masiva/${jobId}?filtro=${value}`}
          >
            {label}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {reviewable ? (
          <BulkImportReviewAction
            action="approve"
            jobId={jobId}
            label="Aprobar para importación"
          />
        ) : null}
        {approved && job.import_type === "FIRST_PARTY" ? (
          <>
            <BulkImportExecutionAction jobId={jobId} />
            <BulkImportReviewAction
              action="reopen"
              jobId={jobId}
              label="Reabrir revisión"
            />
          </>
        ) : null}
        {approved && job.import_type === "PARTNER" ? (
          <>
            <BulkImportPartnerExecutionAction jobId={jobId} />
            <BulkImportReviewAction
              action="reopen"
              jobId={jobId}
              label="Reabrir revisión"
            />
          </>
        ) : null}
        {(job.status === "PARTIALLY_IMPORTED" ||
          job.status === "FAILED_IMPORT") &&
        job.import_type === "FIRST_PARTY" ? (
          retryReadyRows.length > 0 ? <BulkImportExecutionAction jobId={jobId} retry /> : <span className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">Corrige las filas fallidas antes de reintentar.</span>
        ) : null}
        {(job.status === "PARTIALLY_IMPORTED" ||
          job.status === "FAILED_IMPORT") &&
        job.import_type === "PARTNER" ? (
          retryReadyRows.length > 0 ? <BulkImportPartnerExecutionAction jobId={jobId} retry /> : <span className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">Corrige las filas fallidas antes de reintentar.</span>
        ) : null}
        {!imported ? (
          <BulkImportDiscardForm jobId={jobId} approved={approved} />
        ) : (
          <span className="text-muted-foreground rounded-lg border px-3 py-2 text-sm">
            Esta carga se conserva para auditoría.
          </span>
        )}
      </div>
      {imported ? (
        <div className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold">{job.status === "FAILED_IMPORT" ? "Importación fallida" : job.import_type === "PARTNER" ? "Resultados de publicaciones" : "Resultados de importación"}</h2>
          <p className="mt-1 text-sm font-medium">{importedRows.length} borradores creados · {skippedRows.length} omitidos · {failedRows.length} filas fallidas{job.status === "PARTIALLY_IMPORTED" ? ` · ${retryReadyRows.length > 0 ? retryReadyRows.length + " listas para reintentar" : failedRows.length + " pendientes de corrección"}` : ""}</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {importedRows.length === 0 ? "No se crearon borradores en esta ejecución." : "Los borradores deben revisarse y aprobarse antes de publicarse."}
          </p>
          <div className="mt-3 grid gap-2 text-sm">
            {reviewRows
              .filter((row) => row.marketplace_listing_id)
              .map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <span>{row.external_id ?? `Fila ${row.row_number}`}</span>
                  <Link
                    className="underline"
                    href={`/operacion/marketplace/publicaciones/${row.marketplace_listing_id}`}
                  >
                    Ver borrador
                  </Link>
                </div>
              ))}
          </div>
          {failedRows.some((row) => row.execution_error?.includes("error interno")) ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">Corrige el problema del sistema antes de reintentar.</p> : null}
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-3">Estado</th>
              <th className="p-3">Fila</th>
              <th className="p-3">ID externo</th>
              <th className="p-3">Categoría</th>
              <th className="p-3">Marca / modelo</th>
              <th className="p-3">Año</th>
              <th className="p-3">Precio</th>
              <th className="p-3">Problemas</th>
              <th className="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => {
              const yearMismatch = hasCanonicalModelYearMismatch({
                canonicalModelYear: row.canonical_model_year,
                normalizedModelYear:
                  Number(row.normalized_payload.modelYear) || null,
              });
              const pricing =
                job.import_type === "FIRST_PARTY"
                  ? getFirstPartyBulkPricingReadiness({
                      normalized_payload: row.normalized_payload,
                      pricing_result: row.pricing_result,
                    })
                  : getPartnerBulkPricingReadiness({
                      normalized_payload: row.normalized_payload,
                      pricing_result: row.pricing_result,
                    });
              const state = currentStates.get(row.id);
              const executionFailed = row.execution_status === "FAILED";
              const rowRetryReady = retryReadyRows.some((candidate) => candidate.id === row.id);
              const canEditRow = canEditBulkRow(job.status, row.execution_status);
              const receivedPrice =
                row.original_payload["Precio propuesto"] ??
                row.original_payload["Precio solicitado"] ??
                "—";
              const tone = row.excluded
                ? "border-muted bg-muted/30 text-muted-foreground"
                : row.execution_status === "IMPORTED"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : executionFailed && rowRetryReady
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : executionFailed
                  ? "border-red-200 bg-red-50 text-red-900"
                : state?.severity === "READY"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : state?.severity === "WARNING"
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-red-200 bg-red-50 text-red-900";
              const badge = row.excluded
                ? "⚪ Excluida"
                : row.execution_status === "IMPORTED"
                  ? "🟢 Importada"
                : executionFailed && rowRetryReady
                  ? "🟢 Lista para reintentar"
                : executionFailed
                  ? "🔴 Requiere corrección"
                : state?.severity === "READY"
                  ? "🟢 Lista"
                  : state?.severity === "WARNING"
                    ? "🟠 Advertencia"
                    : "🔴 Error";
              return (
                <tr key={row.id} className="border-b align-top">
                  <td className="p-3">
                    <span
                      className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${tone}`}
                    >
                      {badge}
                    </span>
                  </td>
                  <td className="p-3">{row.row_number}</td>
                  <td className="p-3">{row.external_id ?? "—"}</td>
                  <td className="p-3">
                    {categoryLabel(row.normalized_payload.category)}
                  </td>
                  <td className="p-3">
                    {String(row.normalized_payload.brand ?? "—")} /{" "}
                    {String(row.normalized_payload.model ?? "—")}
                  </td>
                  <td className="p-3">
                    {String(row.normalized_payload.modelYear ?? "—")}
                    {row.canonical_model_year != null && yearMismatch
                      ? ` (catálogo: ${row.canonical_model_year})`
                      : ""}
                  </td>
                  <td className="p-3">
                    {getDisplayedReviewedPriceMinor(row.pricing_result, row.normalized_payload) == null
                      ? "—"
                      : `$${(getDisplayedReviewedPriceMinor(row.pricing_result, row.normalized_payload)! / 100).toFixed(2)}`}
                    <span className="text-muted-foreground block text-xs">
                      {pricing.label}
                    </span>
                  </td>
                  <td className="max-w-sm p-3">
                    {executionFailed ? (
                      <div className="mb-1 rounded border border-red-200 bg-red-50 p-2">
                        <span className="mr-1 text-xs font-semibold">🔴 Error de creación</span>
                        <span className="text-xs">{row.execution_error ?? "No se pudo crear el borrador de publicación para esta fila."}</span>
                      </div>
                    ) : (state?.issues?.length ?? 0) > 0 ? state!.issues.map((issue) => (
                      <div
                        key={`${issue.code}-${issue.field ?? ""}`}
                        className="mb-1 rounded border bg-white/70 p-2"
                      >
                        <span className="mr-1 text-xs font-semibold">
                          {issue.severity === "ERROR"
                            ? "🔴 Error"
                            : issue.severity === "WARNING"
                              ? "🟠 Advertencia"
                              : "🔵 Info"}
                        </span>
                        <span className="text-xs">{issue.message}</span>
                      </div>
                    )) : "—"}
                  </td>
                  <td className="p-3">
                    <div className="grid gap-2">
                      {canEditRow ? (
                        row.excluded ? (
                          <BulkImportReviewAction
                            action="reinclude"
                            jobId={jobId}
                            rowId={row.id}
                            label="Reincluir fila"
                          />
                        ) : (
                          <BulkImportReviewAction
                            action="exclude"
                            jobId={jobId}
                            rowId={row.id}
                            label="Excluir fila"
                            variant="destructive"
                          />
                        )
                      ) : null}
                      {canEditRow
                        ? (row.validation_result?.modelCandidates ?? []).map(
                            (candidate) => (
                              <BulkImportReviewAction
                                key={candidate.id}
                                action="resolve_model"
                                jobId={jobId}
                                rowId={row.id}
                                label={`Elegir ${candidate.name}${candidate.modelYear ? ` — ${candidate.modelYear}` : ""}`}
                              />
                            ),
                          )
                        : null}
                      {canEditRow &&
                      yearMismatch &&
                      row.canonical_model_year != null ? (
                        <BulkImportCanonicalYearAction
                          jobId={jobId}
                          rowId={row.id}
                          year={row.canonical_model_year}
                        />
                      ) : null}
                      {canEditRow ? (
                        <BulkImportEditRowForm
                          jobId={jobId}
                          rowId={row.id}
                          row={row.normalized_payload}
                          pricingResult={row.pricing_result}
                          importType={job.import_type}
                        />
                      ) : null}
                      {canEditRow &&
                      Object.keys(row.normalization_metadata).length > 0 &&
                      !row.normalization_accepted ? (
                        <BulkImportReviewAction
                          action="accept_normalization"
                          jobId={jobId}
                          rowId={row.id}
                          label="Aceptar normalización"
                        />
                      ) : null}
                      <details>
                        <summary className="cursor-pointer text-xs underline">
                          Ver detalle
                        </summary>
                        <div className="mt-2 grid gap-2 text-xs">
                          <p>
                            <strong>Datos recibidos:</strong>{" "}
                            {jsonValue(row.original_payload)}
                          </p>
                          <p>
                            <strong>Interpretado:</strong>{" "}
                            {jsonValue(row.normalized_payload)}
                          </p>
                          <p>
                            <strong>Precio recibido:</strong>{" "}
                            {String(receivedPrice)} ·{" "}
                            <strong>Precio revisado:</strong>{" "}
                            {getDisplayedReviewedPriceMinor(row.pricing_result, row.normalized_payload) == null
                              ? "—"
                              : `$${(getDisplayedReviewedPriceMinor(row.pricing_result, row.normalized_payload)! / 100).toFixed(2)}`}
                          </p>
                          <p>
                            <strong>Referencia:</strong>{" "}
                            {row.canonical_model_id
                              ? `Modelo del catálogo (${row.canonical_model_year ?? "año no especificado"})`
                              : row.manual_resolution?.model || (row.manual_resolution?.brand && row.manual_resolution?.model)
                                ? "Modelo manual"
                                : "Sin resolver"}
                          </p>
                          <p>
                            <strong>Pricing:</strong>{" "}
                            {jsonValue(row.pricing_result)}
                          </p>
                          <p>
                            <strong>Fotos:</strong> Clave{" "}
                            {row.photo_metadata?.normalizedKey ?? "—"} ·{" "}
                            {row.photo_metadata?.status ?? "No indicada"}
                          </p>
                          <p>
                            <strong>Normalizaciones:</strong>{" "}
                            {jsonValue(row.normalization_metadata)}
                          </p>
                          <p>
                            <strong>Resultado:</strong>{" "}
                            {row.execution_error ?? "—"}
                          </p>
                        </div>
                      </details>
                      {canEditRow && !row.canonical_model_id ? (
                        <BulkImportManualFallbackForm
                          jobId={jobId}
                          rowId={row.id}
                          manualResolution={row.manual_resolution}
                          normalizedPayload={row.normalized_payload}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
