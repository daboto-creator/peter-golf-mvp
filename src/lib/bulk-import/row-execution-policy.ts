import type { BulkImportType } from "./types";
import { reconcileCurrentRowState } from "./review-reconciliation";

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
