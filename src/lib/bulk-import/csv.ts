import type { RawCsvRow } from "./types";

export const MAX_BULK_IMPORT_ROWS = 500;

export class BulkCsvError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
  }
}

function detectDelimiter(text: string): "," | ";" {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

function parseRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (quoted && next === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell); cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell); cell = "";
      if (row.some((value) => value.trim() !== "")) records.push(row);
      row = [];
    } else cell += char;
  }
  if (quoted) throw new BulkCsvError("El CSV tiene comillas sin cerrar.", "MALFORMED_CSV");
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) records.push(row);
  return records;
}

function cleanHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").normalize("NFKC").trim();
}

export function parseSpanishCsv(input: string | Uint8Array): { headers: string[]; rows: RawCsvRow[]; delimiter: "," | ";" } {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(text);
  const records = parseRecords(text, delimiter);
  if (records.length === 0) throw new BulkCsvError("El archivo no contiene filas.", "EMPTY_CSV");
  const headers = records[0].map(cleanHeader);
  if (headers.some((header) => !header)) throw new BulkCsvError("El CSV contiene encabezados vacíos.", "EMPTY_HEADER");
  const normalizedHeaders = headers.map((header) => header.toLocaleLowerCase("es-MX"));
  if (new Set(normalizedHeaders).size !== normalizedHeaders.length) throw new BulkCsvError("El CSV contiene encabezados duplicados.", "DUPLICATE_HEADER");
  const rows = records.slice(1).map((record, index) => ({
    rowNumber: index + 2,
    values: Object.fromEntries(headers.map((header, column) => [header, (record[column] ?? "").trim()])),
  }));
  if (rows.length > MAX_BULK_IMPORT_ROWS) throw new BulkCsvError(`El archivo supera el límite de ${MAX_BULK_IMPORT_ROWS} filas.`, "ROW_LIMIT_EXCEEDED");
  return { headers, rows, delimiter };
}

export function escapeCsvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\n\r;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function exportErrorCsv(rows: Array<Record<string, unknown>>): string {
  const headers = ["Fila", "ID externo", "Estado", "Código", "Problema"];
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(headers.map((header) => escapeCsvCell(row[header])).join(","));
  return `${lines.join("\n")}\n`;
}
