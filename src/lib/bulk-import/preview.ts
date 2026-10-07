import type { BulkImportType, BulkIssue, BulkPreview, CatalogModelReference, ResolvedBulkRow } from "./types";
import { parseSpanishCsv } from "./csv";
import { normalizeBulkRow, resolveModelWithinContext } from "./normalization";
import { runPricingPrecheck } from "./pricing-precheck";
import { normalizePhotoKey } from "./normalization";

function rowIssues(row: ReturnType<typeof normalizeBulkRow>, importType: BulkImportType): BulkIssue[] {
  const issues: BulkIssue[] = [];
  for (const [name, normalized] of Object.entries(row.fields)) {
    if (normalized.kind === "INVALID" || normalized.kind === "AMBIGUOUS") issues.push({ severity: "ERROR", code: normalized.code ?? "INVALID_FIELD", field: name, message: normalized.code === "AMBIGUOUS_MONEY_FORMAT" ? "El formato del monto es ambiguo. Escríbelo sin símbolo ni separadores de miles, por ejemplo: 10500.00" : "Revisa este valor antes de continuar." });
    else if (normalized.kind === "NORMALIZED_WITH_WARNING") issues.push({ severity: "WARNING", code: normalized.code ?? "NORMALIZED_WITH_WARNING", field: name, message: "El valor se podrá revisar antes de importar." });
  }
  if (importType === "FIRST_PARTY" && row.normalized.acquisitionCostMinor === null) issues.push({ severity: "ERROR", code: "MISSING_ACQUISITION_COST", field: "acquisitionCost", message: "First Party requiere Costo adquisición." });
  if (importType === "PARTNER" && row.normalized.acquisitionCostMinor !== null) issues.push({ severity: "INFO", code: "PARTNER_COST_IGNORED", field: "acquisitionCost", message: "Partner no captura costo de adquisición." });
  if (row.normalized.quantity !== null && row.normalized.quantity <= 0) issues.push({ severity: "ERROR", code: "INVALID_QUANTITY", field: "quantity", message: "La cantidad debe ser mayor que cero." });
  return issues;
}

export function buildBulkPreview(input: { csv: string | Uint8Array; importType: BulkImportType; models: CatalogModelReference[]; existingExternalIds?: ReadonlySet<string> }): BulkPreview {
  const parsed = parseSpanishCsv(input.csv);
  const rows: ResolvedBulkRow[] = parsed.rows.map((raw) => {
    const normalized = normalizeBulkRow(raw);
    const issues = rowIssues(normalized, input.importType);
    const resolution = resolveModelWithinContext({ row: normalized, models: input.models });
    if (resolution.issue) issues.push({ severity: resolution.issue.code === "MODEL_SUGGESTION" ? "WARNING" : "ERROR", code: resolution.issue.code, field: "model", message: resolution.issue.message, details: resolution.issue.details });
    if (normalized.normalized.externalId && input.existingExternalIds?.has(normalized.normalized.externalId)) issues.push({ severity: "WARNING", code: "EXTERNAL_ID_EXISTS", field: "externalId", message: "Este ID externo ya existe. La fila se omitirá en una importación futura." });
    const pricing = runPricingPrecheck({ importType: input.importType, row: normalized });
    if (pricing.status === "INSUFFICIENT_DATA") issues.push({ severity: "WARNING", code: "INSUFFICIENT_DATA", field: "price", message: "Requiere revisión de precio." });
    const photoKey = normalizePhotoKey(normalized.original["Clave fotos"] ?? normalized.original["Clave de fotos"] ?? "");
    const photo = photoKey ? { sourceType: null, normalizedKey: photoKey, status: "PENDING_ACCESS" as const } : { sourceType: null, normalizedKey: null, status: "NOT_PROVIDED" as const };
    const severity = issues.some((issue) => issue.severity === "ERROR") ? "ERROR" : issues.some((issue) => issue.severity === "WARNING") ? "WARNING" : "READY";
    return { ...normalized, canonicalBrandId: resolution.candidates[0]?.brandId ?? null, canonicalCategoryId: resolution.candidates[0]?.categoryId ?? null, canonicalModelId: resolution.modelId, modelCandidates: resolution.candidates, issues, pricing, photo, severity };
  });
  return { importType: input.importType, rows, summary: { total: rows.length, ready: rows.filter((row) => row.severity === "READY").length, warnings: rows.filter((row) => row.severity === "WARNING").length, errors: rows.filter((row) => row.severity === "ERROR").length } };
}
