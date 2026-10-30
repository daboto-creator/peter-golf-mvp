import type { BulkImportStatus, BulkImportType } from "./types";

export type FirstPartyExecutionDecision =
  | { allowed: true }
  | { allowed: false; code: string; message: string };

export function canExecuteFirstPartyBulkImport(input: {
  importType: BulkImportType;
  status: BulkImportStatus;
  isOperator: boolean;
  importableRows: number;
  hasBlockingErrors: boolean;
}): FirstPartyExecutionDecision {
  if (!input.isOperator) return { allowed: false, code: "UNAUTHORIZED", message: "No tienes autorización para importar inventario." };
  if (input.importType !== "FIRST_PARTY") return { allowed: false, code: "PARTNER_NOT_SUPPORTED", message: "Esta carga corresponde a un Partner y no puede importarse desde este flujo." };
  if (!["APPROVED_FOR_IMPORT", "PARTIALLY_IMPORTED", "FAILED_IMPORT"].includes(input.status)) return { allowed: false, code: "INVALID_STATE", message: "La carga debe estar aprobada para importar." };
  if (input.importableRows < 1) return { allowed: false, code: "NO_ROWS", message: "No hay filas listas para importar." };
  if (input.hasBlockingErrors) return { allowed: false, code: "BLOCKING_ERRORS", message: "Resuelve o excluye las filas con errores antes de importar." };
  return { allowed: true };
}

export function canExecutePartnerBulkImport(input: {
  importType: BulkImportType;
  status: BulkImportStatus;
  isOperator: boolean;
  partnerProfileId: string | null;
  importableRows: number;
  hasBlockingErrors: boolean;
  pricingReady: boolean;
}): FirstPartyExecutionDecision {
  if (!input.isOperator) return { allowed: false, code: "UNAUTHORIZED", message: "No tienes autorización para crear borradores." };
  if (input.importType !== "PARTNER") return { allowed: false, code: "FIRST_PARTY_NOT_SUPPORTED", message: "Esta carga corresponde a Best Round y no puede crear borradores Partner." };
  if (!input.partnerProfileId) return { allowed: false, code: "MISSING_PARTNER", message: "La carga no tiene un Partner válido." };
  if (!["APPROVED_FOR_IMPORT", "PARTIALLY_IMPORTED", "FAILED_IMPORT"].includes(input.status)) return { allowed: false, code: "INVALID_STATE", message: "La carga debe estar aprobada para crear borradores." };
  if (input.importableRows < 1) return { allowed: false, code: "NO_ROWS", message: "No hay filas listas para crear borradores." };
  if (input.hasBlockingErrors) return { allowed: false, code: "BLOCKING_ERRORS", message: "Resuelve o excluye las filas con errores antes de crear borradores." };
  if (!input.pricingReady) return { allowed: false, code: "PRICING_REVIEW_REQUIRED", message: "El precio de esta fila requiere una nueva revisión." };
  return { allowed: true };
}
