import Link from "next/link";
import { notFound } from "next/navigation";

import {
  DocumentReviewForm,
  PartnerStatusForm,
} from "@/components/marketplace/operations-review-forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePartnerManager } from "@/lib/auth/marketplace-authorization";
import { getPartnerForOperations } from "@/lib/marketplace/partner-data";
import {
  documentKindCopy,
  legalTypeCopy,
  partnerDocumentStatusCopy,
  partnerStatusCopy,
  type PartnerStatus,
} from "@/lib/marketplace/partner-rules";

const transitions: Record<PartnerStatus, Array<[string, string]>> = {
  REGISTERED: [["IDENTITY_PENDING", "Solicitar completar identidad"]],
  IDENTITY_PENDING: [],
  UNDER_REVIEW: [
    ["VERIFIED", "Verificar Partner"],
    ["IDENTITY_PENDING", "Solicitar corrección"],
    ["REJECTED", "Rechazar"],
  ],
  VERIFIED: [["SUSPENDED", "Suspender"]],
  SUSPENDED: [
    ["VERIFIED", "Restaurar verificación"],
    ["REJECTED", "Rechazar"],
  ],
  REJECTED: [["IDENTITY_PENDING", "Permitir correcciones"]],
};

const automaticResultCopy = {
  PASSED: "Validado",
  REVIEW_REQUIRED: "Requiere revisión",
  FAILED: "Inconsistente",
} as const;

const csfWarningCopy: Record<string, string> = {
  CSF_EXTRACTION_INCOMPLETE: "No fue posible extraer todos los datos fiscales.",
  RFC_MISMATCH: "El RFC no coincide con el perfil fiscal.",
  FISCAL_NAME_MISMATCH: "El nombre fiscal no coincide con el perfil.",
  SAT_QR_MISSING: "La constancia no contiene un QR detectable.",
  SAT_QR_UNREADABLE: "No fue posible leer el QR automáticamente.",
  SAT_QR_DESTINATION_NOT_OFFICIAL:
    "El QR no dirige al validador oficial permitido del SAT.",
  SAT_QR_RFC_NOT_EXTRACTED: "No fue posible confirmar el RFC desde el QR.",
  SAT_QR_RFC_MISMATCH: "El RFC del QR no coincide con el documento.",
  CSF_ANALYSIS_ERROR: "El análisis automático no pudo completarse.",
  REGISTERED_FISCAL_DATA_INCOMPLETE:
    "El perfil aún no tiene todos los datos fiscales para comparar.",
  AUTOMATIC_CONTENT_EXTRACTION_PENDING: "El análisis está pendiente.",
};

function normalizedField(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" || typeof field === "boolean" ? field : null;
}

function normalizedNumber(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "number" && Number.isFinite(field) ? field : null;
}

function normalizedNumberArray(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const field = (value as Record<string, unknown>)[key];
  return Array.isArray(field)
    ? field.filter(
        (entry): entry is number =>
          typeof entry === "number" && Number.isInteger(entry) && entry > 0,
      )
    : [];
}

function matchCopy(value: unknown) {
  return value === true
    ? "Coincide"
    : value === false
      ? "No coincide"
      : "No determinado";
}

export default async function PartnerOperationsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePartnerManager(`/operacion/marketplace/partners/${id}`);
  const result = await getPartnerForOperations(id);
  if (!result.partner || result.error) notFound();
  const partner = result.partner;
  const latestIdentity = result.identity[0];
  const analysesByDocument = new Map<
    string,
    (typeof result.analyses)[number]
  >();
  for (const analysis of result.analyses) {
    if (!analysesByDocument.has(analysis.document_id)) {
      analysesByDocument.set(analysis.document_id, analysis);
    }
  }
  const warnings = [
    ...(latestIdentity?.warning_codes ?? []),
    ...[...analysesByDocument.values()].flatMap(
      (analysis) => analysis.warning_codes,
    ),
  ];
  const fiscalDocument = result.documents.find(
    (document) => document.document_kind === "fiscal_certificate",
  );
  const fiscalAnalysis = fiscalDocument
    ? analysesByDocument.get(fiscalDocument.id)
    : undefined;
  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
            Revisión Partner
          </p>
          <h1 className="mt-3 text-4xl font-semibold">
            {partner.commercial_name ||
              [partner.first_name, partner.last_name]
                .filter(Boolean)
                .join(" ") ||
              "Perfil por completar"}
          </h1>
          <p className="text-muted-foreground mt-3">
            {legalTypeCopy[partner.legal_type].label} ·{" "}
            {partnerStatusCopy[partner.status].label}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/operacion/marketplace/partners/${partner.id}/score`}>
              Score y Tier
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/operacion/marketplace/partners">Volver</Link>
          </Button>
        </div>
      </header>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Perfil privado</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <p>
                <strong>Nombre:</strong>{" "}
                {[partner.first_name, partner.last_name]
                  .filter(Boolean)
                  .join(" ") || "—"}
              </p>
              <p>
                <strong>Empresa:</strong> {partner.commercial_name || "—"}
              </p>
              <p>
                <strong>Representante:</strong>{" "}
                {partner.representative_name || "—"}
              </p>
              <p>
                <strong>Teléfono:</strong> {partner.phone || "—"}
              </p>
              <p>
                <strong>Ubicación:</strong>{" "}
                {[partner.city, partner.state, partner.country_code]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </p>
              <p>
                <strong>RFC:</strong> {partner.tax_id || "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Revisión consolidada</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <p>
                <strong>Tipo legal:</strong>{" "}
                {legalTypeCopy[partner.legal_type].label}
              </p>
              <p>
                <strong>Validación de identidad:</strong>{" "}
                {latestIdentity?.result ?? "Pendiente"}
              </p>
              <p>
                <strong>Coincidencia de nombre:</strong>{" "}
                {latestIdentity?.normalized_attributes
                  ? "Revisar evidencia normalizada"
                  : "Pendiente"}
              </p>
              <p>
                <strong>Prueba de vida:</strong>{" "}
                {partner.legal_type === "LEGAL_ENTITY"
                  ? "No requerida"
                  : latestIdentity?.liveness_passed
                    ? "Recibida"
                    : "Pendiente"}
              </p>
              <p>
                <strong>Face match 1:1:</strong>{" "}
                {partner.legal_type === "LEGAL_ENTITY"
                  ? "No requerido"
                  : latestIdentity?.face_match_passed
                    ? "Recibido"
                    : "Pendiente"}
              </p>
              <p>
                <strong>CSF / RFC:</strong>{" "}
                {fiscalAnalysis?.extracted_rfc
                  ? "Analizado"
                  : "Pendiente de análisis"}
              </p>
              <p>
                <strong>SAT QR:</strong>{" "}
                {normalizedField(
                  fiscalAnalysis?.normalized_output,
                  "qrStatus",
                ) === "VERIFIED"
                  ? "Verificado"
                  : normalizedField(
                        fiscalAnalysis?.normalized_output,
                        "qrStatus",
                      ) === "NOT_VERIFIED"
                    ? "No verificado"
                    : "No disponible"}
              </p>
              <p>
                <strong>Documento migratorio:</strong>{" "}
                {partner.country_code === "MX"
                  ? "No aplica"
                  : result.documents.some(
                        (entry) =>
                          entry.document_kind === "immigration_document",
                      )
                    ? "Recibido"
                    : "Pendiente"}
              </p>
              <p className="sm:col-span-2">
                <strong>Recomendación:</strong>{" "}
                {warnings.length
                  ? "Revisión humana requerida"
                  : latestIdentity?.result === "PASSED" ||
                      partner.legal_type === "LEGAL_ENTITY"
                    ? "Evidencia lista para validación humana"
                    : "Esperar evidencia"}
              </p>
              {warnings.length ? (
                <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 sm:col-span-2">
                  <strong>Alertas:</strong>{" "}
                  {warnings
                    .map((warning) => csfWarningCopy[warning] ?? warning)
                    .join(" ")}
                </p>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Documentos</CardTitle>
            </CardHeader>
            <CardContent>
              {result.documents.length ? (
                <div className="space-y-5">
                  {result.documents.map((document) => {
                    const analysis = analysesByDocument.get(document.id);
                    const isFiscal =
                      document.document_kind === "fiscal_certificate";
                    return (
                      <article
                        key={document.id}
                        className="rounded-xl border p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <strong>
                              {documentKindCopy[
                                document.document_kind as keyof typeof documentKindCopy
                              ] ?? "Documento"}
                            </strong>
                            <p className="text-muted-foreground text-xs">
                              {partnerDocumentStatusCopy[document.status]} ·{" "}
                              {(document.size_bytes / 1024).toFixed(0)} KiB
                            </p>
                          </div>
                          <Button asChild size="sm" variant="outline">
                            <Link
                              href={`/operacion/marketplace/partners/${partner.id}/documentos/${document.id}`}
                              target="_blank"
                            >
                              Abrir de forma segura
                            </Link>
                          </Button>
                        </div>
                        {partner.status === "UNDER_REVIEW" ? (
                          <DocumentReviewForm
                            documentId={document.id}
                            version={document.version}
                          />
                        ) : (
                          <p className="text-muted-foreground mt-3 text-sm">
                            La revisión se habilita cuando el Partner envía su
                            solicitud.
                          </p>
                        )}
                        {analysis && isFiscal ? (
                          <div className="mt-3 space-y-3 rounded-lg bg-black/5 p-3 text-xs">
                            <p>
                              <strong>Resultado automático:</strong>{" "}
                              {automaticResultCopy[analysis.result]}
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <p>
                                <strong>RFC registrado:</strong>{" "}
                                {partner.tax_id || "—"}
                              </p>
                              <p>
                                <strong>RFC extraído:</strong>{" "}
                                {analysis.extracted_rfc || "—"}
                              </p>
                              <p>
                                <strong>Coincidencia RFC:</strong>{" "}
                                {matchCopy(
                                  normalizedField(
                                    analysis.normalized_output,
                                    "rfcMatches",
                                  ),
                                )}
                              </p>
                              <p>
                                <strong>SAT QR:</strong>{" "}
                                {normalizedField(
                                  analysis.normalized_output,
                                  "qrStatus",
                                ) === "VERIFIED"
                                  ? "Verificado"
                                  : normalizedField(
                                        analysis.normalized_output,
                                        "qrStatus",
                                      ) === "NOT_VERIFIED"
                                    ? "No verificado"
                                    : "No disponible"}
                              </p>
                              <p>
                                <strong>Nombre fiscal registrado:</strong>{" "}
                                {partner.legal_name || "—"}
                              </p>
                              <p>
                                <strong>Nombre fiscal extraído:</strong>{" "}
                                {analysis.extracted_name || "—"}
                              </p>
                              <p>
                                <strong>Coincidencia de nombre:</strong>{" "}
                                {matchCopy(
                                  normalizedField(
                                    analysis.normalized_output,
                                    "nameMatches",
                                  ),
                                )}
                              </p>
                            </div>
                            <div className="grid gap-2 border-t border-black/10 pt-3 sm:grid-cols-2">
                              <p>
                                <strong>Fuente de extracción:</strong>{" "}
                                {normalizedField(
                                  analysis.normalized_output,
                                  "extractionSource",
                                ) ?? "No disponible"}
                              </p>
                              <p>
                                <strong>Páginas PDF inspeccionadas:</strong>{" "}
                                {normalizedNumber(
                                  analysis.normalized_output,
                                  "pdfPagesInspected",
                                ) ?? "—"}
                              </p>
                              <p>
                                <strong>Texto fiscal útil:</strong>{" "}
                                {normalizedField(
                                  analysis.normalized_output,
                                  "usefulTextSignalDetected",
                                ) === true
                                  ? "Sí"
                                  : "No"}
                              </p>
                              <p>
                                <strong>OCR utilizado:</strong>{" "}
                                {normalizedField(
                                  analysis.normalized_output,
                                  "ocrUsed",
                                ) === true
                                  ? "Sí"
                                  : "No"}
                              </p>
                              <p>
                                <strong>Páginas intentadas para QR:</strong>{" "}
                                {normalizedNumberArray(
                                  analysis.normalized_output,
                                  "qrPagesAttempted",
                                ).join(", ") || "—"}
                              </p>
                              <p>
                                <strong>QR decodificado:</strong>{" "}
                                {normalizedField(
                                  analysis.normalized_output,
                                  "qrDecoded",
                                ) === true
                                  ? "Sí"
                                  : "No"}
                              </p>
                            </div>
                            {analysis.warning_codes.length ? (
                              <p>
                                <strong>Resumen:</strong>{" "}
                                {analysis.warning_codes
                                  .map(
                                    (warning) =>
                                      csfWarningCopy[warning] ??
                                      "Requiere validación manual.",
                                  )
                                  .join(" ")}
                              </p>
                            ) : null}
                          </div>
                        ) : analysis ? (
                          <p className="mt-3 rounded-lg bg-black/5 p-3 text-xs">
                            Análisis automático:{" "}
                            {automaticResultCopy[analysis.result]}
                          </p>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Sin documentos.</p>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Cambiar estado</CardTitle>
            </CardHeader>
            <CardContent>
              {transitions[partner.status].length ? (
                <PartnerStatusForm
                  partnerId={partner.id}
                  version={partner.version}
                  options={transitions[partner.status]}
                />
              ) : (
                <p className="text-muted-foreground text-sm">
                  No hay transiciones disponibles.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Historial</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                {result.history.map((entry) => (
                  <li key={entry.id} className="border-l-2 pl-4 text-sm">
                    <strong>{partnerStatusCopy[entry.to_status].label}</strong>
                    <p className="text-muted-foreground mt-1">
                      {new Intl.DateTimeFormat("es-MX", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(entry.created_at))}
                    </p>
                    {entry.reason ? (
                      <p className="mt-1">{entry.reason}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
