import { bulkImportStatuses, type BulkImportStatus } from "./types";

const processingStatuses = new Set<BulkImportStatus>([
  "PARSING",
  "NORMALIZING",
  "VALIDATING",
  "RESOLVING_CATALOG",
  "RESOLVING_ASSETS",
  "ANALYZING_PRICING",
]);

const protectedStatuses = new Set(["IMPORTED", "PARTIALLY_IMPORTED", "DOMAIN_WRITES_COMPLETE"]);

export type BulkImportDiscardJob = {
  status: string;
  partnerProfileId: string | null;
  finalDomainWriteState?: string | null;
};

export type BulkImportDiscardActor = {
  isOperator: boolean;
  partnerProfileId?: string | null;
};

export type BulkImportDiscardDecision =
  | { allowed: true }
  | { allowed: false; code: "IMPORTED_JOB_PROTECTED" | "JOB_PROCESSING" | "UNAUTHORIZED_JOB" | "JOB_NOT_DISCARDABLE"; message: string };

export function canDiscardBulkImportJob(job: BulkImportDiscardJob, actor: BulkImportDiscardActor): BulkImportDiscardDecision {
  if (job.finalDomainWriteState || protectedStatuses.has(job.status)) {
    return { allowed: false, code: "IMPORTED_JOB_PROTECTED", message: "Esta carga ya generó datos finales y debe conservarse para auditoría." };
  }
  if (processingStatuses.has(job.status as BulkImportStatus)) {
    return { allowed: false, code: "JOB_PROCESSING", message: "Esta carga todavía se está procesando. Cancélala o espera a que termine antes de descartarla." };
  }
  if (!bulkImportStatuses.includes(job.status as BulkImportStatus)) {
    return { allowed: false, code: "JOB_NOT_DISCARDABLE", message: "Esta carga no se puede descartar en su estado actual." };
  }
  if (!actor.isOperator && (!job.partnerProfileId || actor.partnerProfileId !== job.partnerProfileId)) {
    return { allowed: false, code: "UNAUTHORIZED_JOB", message: "No tienes autorización para descartar esta carga." };
  }
  return { allowed: true };
}

/** PR82 stores source references and audit JSON only; no temporary blobs are persisted. */
export const bulkImportTemporaryArtifactPolicy = {
  persistsBlobs: false,
  dynamicErrorCsv: true,
  deleteOnlyOwnedArtifacts: true,
} as const;
