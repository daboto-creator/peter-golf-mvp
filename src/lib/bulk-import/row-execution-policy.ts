import type { BulkImportType } from "./types";
import { reconcileCurrentRowState } from "./review-reconciliation";
import { hasBulkModelIdentityChanged } from "./model-identity";
import { normalizeFirstPartyPricingState } from "./review-policy";

export { hasBulkModelIdentityChanged } from "./model-identity";

export function hasBulkAcquisitionCostChanged(previousCostMinor: unknown, submittedCostMinor: number | null) {
  return submittedCostMinor !== null && submittedCostMinor !== Number(previousCostMinor ?? 0);
}

export function getPricingAfterManualModelApproval(input: {
  importType: BulkImportType;
  previousPayload: Record<string, unknown>;
  approvedPayload: Record<string, unknown>;
  currentPricing: Record<string, unknown> | null | undefined;
}) {
  if (!hasBulkModelIdentityChanged(input.previousPayload, input.approvedPayload)) {
    return input.importType === "FIRST_PARTY"
      ? normalizeFirstPartyPricingState(input.currentPricing)
      : input.currentPricing;
  }

  const invalidated = {
    ...(input.currentPricing ?? {}),
    status: "INSUFFICIENT_DATA",
    proposedPriceMinor: null,
    approvedPriceMinor: null,
    calculatedPublicPriceMinor: null,
    manualPriceApproved: false,
    manualOverride: false,
    manualPriceReason: null,
    humanReviewStatus: null,
    stale: true,
    viability: "Requiere nuevo análisis",
  };

  return input.importType === "PARTNER"
    ? {
        ...invalidated,
        marketStatus: "INSUFFICIENT_DATA",
        marketReferenceMinor: null,
        estimatedPartnerNetMinor: null,
        economics: null,
        reusedResearch: false,
      }
    : invalidated;
}

export function deriveBulkJobAggregate(rows: Array<{ excluded?: boolean; execution_status?: string | null }>) {
  const included = rows.filter((row) => !row.excluded);
  const imported = included.filter((row) => row.execution_status === "IMPORTED").length;
  const skipped = included.filter((row) => row.execution_status === "SKIPPED_EXISTING").length;
  const failed = included.filter((row) => row.execution_status === "FAILED").length;
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
  canonicalModelId?: string | null;
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
    canonicalModelId: input.canonicalModelId,
    canonicalModelYear: input.canonicalModelYear,
    manualResolution: input.manualResolution,
  }).severity !== "ERROR";
}
