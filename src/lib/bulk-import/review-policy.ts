export type ReviewApprovalRow = { excluded?: boolean; severity: string };

export function canApproveBulkImport(rows: ReviewApprovalRow[]) {
  const included = rows.filter((row) => !row.excluded);
  if (included.length === 0) return { allowed: false as const, code: "NO_INCLUDED_ROWS", message: "Debes conservar al menos una fila para aprobar la carga." };
  if (included.some((row) => row.severity === "ERROR")) return { allowed: false as const, code: "INCLUDED_ERRORS", message: "No puedes aprobar la carga mientras existan filas incluidas con errores." };
  return { allowed: true as const, includedCount: included.length };
}
