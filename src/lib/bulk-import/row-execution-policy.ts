import type { BulkImportType } from "./types";
import { reconcileCurrentRowState } from "./review-reconciliation";

export function hasBulkModelIdentityChanged(previous: Record<string, unknown>, next: Record<string, unknown>) {
  const normalize = (field: string, value: unknown) => field === "modelYear" ? (Number(value) || null) : String(value ?? "").trim().toLocaleLowerCase("es-MX");
  return ["brand", "model", "category", "modelYear"].some((field) => normalize(field, previous[field]) !== normalize(field, next[field]));
}

export function hasBulkAcquisitionCostChanged(previousCostMinor: unknown, submittedCostMinor: number | null) {
  return submittedCostMinor !== null && submittedCostMinor !== Number(previousCostMinor ?? 0);
}

export function getFirstPartyPricingAfterManualModelApproval(input: {
  previousPayload: Record<string, unknown>;
  approvedPayload: Record<string, unknown>;
  currentPricing: Record<string, unknown> | null | undefined;
  invalidatedPricing: Record<string, unknown>;
}) {
  return hasBulkModelIdentityChanged(input.previousPayload, input.approvedPayload)
    ? input.invalidatedPricing
    : input.currentPricing;
}

export function deriveBulkJobAggregate(rows: Array<{ excluded?: boolean; execution_status?: string | null }>) {
  const included = rows.filter((row) => !row.excluded);
  const imported = rows.filter((row) => row.execution_status === "IMPORTED").length;
  const skipped = rows.filter((row) => row.execution_status === "SKIPPED_EXISTING").length;
  const failed = rows.filter((row) => row.execution_status === "FAILED").length;
  const status = failed === 0 && imported + skipped >= included.length ? "IMPORTED" : imported === 0 && failed > 0 ? "FAILED_IMPORT" : "PARTIALLY_IMPORTED";
  return { imported, skipped, failed, status } as const;
}

export function canEditBulkRow(jobStatus: string, executionStatus?: string | null) {
  if (executionStatus === "IMPORTED" || executionStatus === "SKIPPED_EXISTING" || executionStatus === "IMPORTING") return false;
  if (jobStatus === "READY_FOR_REVIEW") return !executionStatus || executionStatus === "PENDING_IMPORT";
  return (jobStatus === "PARTIALLY_IMPORTED" || jobStatus === "FAILED_IMPORT") && executionStatus === "FAILED";
}

export function isBulkRowRetryReady(input: {
  jobStatus: string;
  executionStatus?: string | null;
  excluded?: boolean;
  importType: BulkImportType;
  normalizedPayload: Record<string, unknown>;
  pricingResult: Record<string, unknown> | null | undefined;
  existingIssues: Parameters<typeof reconcileCurrentRowState>[0]["existingIssues"];
  canonicalModelYear?: number | null;
  manualResolution?: Record<string, unknown> | null;
}) {
  if (input.excluded || input.executionStatus !== "FAILED") return false;
  if (input.jobStatus !== "PARTIALLY_IMPORTED" && input.jobStatus !== "FAILED_IMPORT") return false;
  return reconcileCurrentRowState({
    importType: input.importType,
    normalizedPayload: input.normalizedPayload,
    pricingResult: input.pricingResult,
    existingIssues: input.existingIssues,
    canonicalModelYear: input.canonicalModelYear,
    manualResolution: input.manualResolution,
  }).severity !== "ERROR";
}
