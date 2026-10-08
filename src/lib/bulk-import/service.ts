"use server";

import { createHash } from "node:crypto";
import { canCurrentUserManageCatalog, requireCatalogManager } from "@/lib/auth/catalog-authorization";
import { listActiveGolfCatalogReferences } from "@/lib/catalog/operational-products";
import { buildBulkPreview } from "./preview";
import type { BulkImportType, BulkIssue, CatalogModelReference } from "./types";
import { createClient } from "@/lib/supabase/server";
import { canDiscardBulkImportJob } from "./discard-policy";
import { canApproveBulkImport } from "./review-policy";
import { reconcileCurrentRowState } from "./review-reconciliation";
import { normalizeCategory, normalizeCondition, normalizeHand, normalizeYear, parseMoneyToMinorUnits, resolveModelWithinContext } from "./normalization";
import { revalidatePath } from "next/cache";

// The generated Supabase types intentionally lag additive PR82 tables; keep
// this boundary narrow until the next generated schema snapshot.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (client: Awaited<ReturnType<typeof createClient>>, name: string) => client.from(name as never) as any;

export async function listBulkImportPartners() {
  await requireCatalogManager("/operacion/carga-masiva");
  const client = await createClient();
  const result = await client.from("partner_profiles").select("id, status, commercial_name, first_name, last_name, user_id").order("updated_at", { ascending: false });
  return (result.data ?? []).map((partner) => ({ id: partner.id, status: partner.status, label: partner.commercial_name || [partner.first_name, partner.last_name].filter(Boolean).join(" ") || "Partner sin nombre" }));
}

async function resolvePartnerForOperator(partnerId: string | null) {
  if (!partnerId) return null;
  const client = await createClient();
  const result = await client.from("partner_profiles").select("id, status, commercial_name, first_name, last_name").eq("id", partnerId).maybeSingle();
  return result.data ?? null;
}

function modelReferencesFromCatalog(data: Awaited<ReturnType<typeof listActiveGolfCatalogReferences>>): CatalogModelReference[] {
  if (data.error || !data.data) return [];
  const brands = new Map(data.data.brands.map((brand) => [brand.id, brand]));
  const categories = new Map(data.data.categories.map((category) => [category.id, category]));
  return data.data.models.flatMap((model) => {
    const brand = brands.get(model.brandId); const category = categories.get(model.categoryId);
    return brand && category ? [{ id: model.id, brandId: brand.id, brandName: brand.name, brandSlug: brand.slug ?? "", categoryId: category.id, categoryName: category.name, categorySlug: category.slug ?? "", modelName: model.name, normalizedModelName: model.normalizedName, modelYear: model.modelYear ?? null }] : [];
  });
}

function parseReviewedPrice(formData: FormData) {
  const legacyMinor = formData.get("approvedPriceMinor");
  const displayValue = formData.get("approvedPrice");
  if (displayValue !== null && String(displayValue).trim() !== "") return Number(parseMoneyToMinorUnits(String(displayValue)).value ?? 0);
  return Number(legacyMinor ?? 0);
}

async function buildReviewedRowPatch(_client: Awaited<ReturnType<typeof createClient>>, row: { normalized_payload?: Record<string, unknown>; validation_result?: { issues?: Array<{ code?: string; severity?: string; field?: string; message?: string }>; modelCandidates?: Array<{ id: string; name: string; modelYear: number | null }> }; pricing_result?: Record<string, unknown> | null; manual_resolution?: Record<string, unknown> }, formData: FormData, userId: string) {
  const previous = (row.normalized_payload ?? {}) as Record<string, unknown>;
  const next = { ...previous };
  const set = (key: string, value: unknown) => { if (value !== undefined) next[key] = value; };
  const category = normalizeCategory(String(formData.get("category") ?? previous.category ?? ""));
  const year = normalizeYear(String(formData.get("modelYear") ?? previous.modelYear ?? ""));
  const hand = normalizeHand(String(formData.get("hand") ?? previous.hand ?? ""));
  const condition = normalizeCondition(String(formData.get("condition") ?? previous.condition ?? ""));
  set("category", category.value ? String(category.value) : null);
  set("categorySlug", category.value ? String(category.value) : null);
  set("modelYear", year.value);
  set("hand", hand.value);
  set("condition", condition.value);
  const quantityRaw = String(formData.get("quantity") ?? previous.quantity ?? "").trim();
  if (quantityRaw) set("quantity", Number(quantityRaw));
  const costRaw = String(formData.get("acquisitionCost") ?? "").trim();
  const priceRaw = String(formData.get("salePrice") ?? "").trim();
  const costChanged = costRaw !== "";
  const priceChanged = priceRaw !== "";
  if (costChanged) set("acquisitionCostMinor", Number(parseMoneyToMinorUnits(costRaw).value ?? 0));
  if (priceChanged) set("askingPriceMinor", Number(parseMoneyToMinorUnits(priceRaw).value ?? 0));
  const photoKey = String(formData.get("photoKey") ?? "").trim();
  if (photoKey) set("photoKey", photoKey.normalize("NFKC").toLocaleLowerCase("es-MX").replace(/[ _]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""));

  const references = modelReferencesFromCatalog(await listActiveGolfCatalogReferences());
  const reviewedRow = { rowNumber: 0, original: {}, normalized: { ...next, brand: String(next.brand ?? ""), category: String(next.category ?? ""), model: String(next.model ?? "") }, fields: {} } as never;
  const resolution = resolveModelWithinContext({ row: reviewedRow, models: references });
  const canonicalModelId = resolution.modelId;
  let canonicalModelYear: number | null = null;
  if (canonicalModelId) canonicalModelYear = references.find((model) => model.id === canonicalModelId)?.modelYear ?? null;
  const currentIssues = (Array.isArray(row.validation_result?.issues) ? row.validation_result.issues : []) as BulkIssue[];
  const modelIssues: BulkIssue[] = resolution.issue ? [{ severity: resolution.issue.code === "MODEL_SUGGESTION" ? "WARNING" : "ERROR", code: resolution.issue.code, field: "model", message: resolution.issue.message, details: resolution.issue.details }] : [];
  const reconciled = reconcileCurrentRowState({ importType: "FIRST_PARTY", normalizedPayload: next, pricingResult: row.pricing_result, existingIssues: [...currentIssues.filter((issue) => !["UNKNOWN_MODEL", "MODEL_SUGGESTION", "AMBIGUOUS_MODEL_GENERATION"].includes(issue.code)), ...modelIssues], canonicalModelYear });
  let pricingResult = row.pricing_result ?? {};
  const audit = { ...(row.manual_resolution ?? {}), edit: { actorId: userId, source: "BULK_REVIEW", at: new Date().toISOString(), previous: { acquisitionCostMinor: previous.acquisitionCostMinor, askingPriceMinor: previous.askingPriceMinor }, reviewed: { acquisitionCostMinor: next.acquisitionCostMinor, askingPriceMinor: next.askingPriceMinor } } };
  if (costChanged) pricingResult = { ...pricingResult, status: "INSUFFICIENT_DATA", proposedPriceMinor: null, approvedPriceMinor: null, stale: true, manualPriceApproved: false, manualOverride: false, viability: "Requiere nuevo análisis" };
  if (priceChanged && Number(next.askingPriceMinor) > 0 && !costChanged) pricingResult = { ...pricingResult, status: "COMPETITIVE", proposedPriceMinor: Number(next.askingPriceMinor), approvedPriceMinor: Number(next.askingPriceMinor), manualPriceApproved: true, manualOverride: true, manualPriceReason: String(formData.get("reason") ?? "Edición de precio en revisión"), stale: false, viability: "Precio aprobado manualmente" };
  const finalReconciled = reconcileCurrentRowState({ importType: "FIRST_PARTY", normalizedPayload: next, pricingResult, existingIssues: reconciled.issues, canonicalModelYear });
  return { normalized_payload: next, canonical_model_id: canonicalModelId, pricing_result: pricingResult, validation_result: { ...(row.validation_result ?? {}), issues: finalReconciled.issues, modelCandidates: resolution.candidates.map((candidate) => ({ id: candidate.id, name: candidate.modelName, modelYear: candidate.modelYear })) }, severity: finalReconciled.severity, manual_resolution: audit, reviewed_by: userId, reviewed_at: new Date().toISOString() };
}

export async function createBulkImportPreview(formData: FormData) {
  await requireCatalogManager("/operacion/carga-masiva");
  const file = formData.get("csv");
  const importType = formData.get("importType") === "PARTNER" ? "PARTNER" : "FIRST_PARTY" as BulkImportType;
  const partnerIdInput = typeof formData.get("partnerProfileId") === "string" ? String(formData.get("partnerProfileId")) : null;
  if (!(file instanceof File)) return { ok: false as const, message: "Sube un archivo CSV." };
  if (!file.name.toLocaleLowerCase("es-MX").endsWith(".csv")) return { ok: false as const, message: "El archivo debe tener extensión CSV." };
  if (file.size > 2_000_000) return { ok: false as const, message: "El archivo supera el tamaño permitido." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const partner = importType === "PARTNER" ? await resolvePartnerForOperator(partnerIdInput) : null;
  if (importType === "PARTNER" && !partner) return { ok: false as const, message: "Selecciona un Partner válido desde el selector." };
  const references = await listActiveGolfCatalogReferences();
  const preview = buildBulkPreview({ csv: bytes, importType, models: modelReferencesFromCatalog(references) });
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { ok: false as const, message: "Tu sesión expiró." };
  const sourceHash = createHash("sha256").update(bytes).digest("hex");
  const existing = await db(client, "bulk_import_jobs").select("id").eq("created_by", user.id).eq("source_hash", sourceHash).maybeSingle();
  if (existing.data?.id) return { ok: true as const, jobId: existing.data.id, preview };
  const photoSourceType = formData.get("photoSourceType") === "ZIP_UPLOAD" ? "ZIP_UPLOAD" : formData.get("photoSourceType") === "GOOGLE_DRIVE_SHARED_FOLDER" ? "GOOGLE_DRIVE_SHARED_FOLDER" : null;
  const photoSourceReference = typeof formData.get("photoSourceReference") === "string" ? String(formData.get("photoSourceReference")).trim().slice(0, 500) : null;
  const job = await db(client, "bulk_import_jobs").insert({ import_type: importType, partner_profile_id: partner?.id ?? null, source_filename: file.name, source_hash: sourceHash, photo_source_type: photoSourceType, photo_source_reference: photoSourceReference, status: "READY_FOR_REVIEW", row_count: preview.summary.total, ready_count: preview.summary.ready, warning_count: preview.summary.warnings, error_count: preview.summary.errors, created_by: user.id }).select("id").single();
  if (job.error) return { ok: false as const, message: "No pudimos guardar el historial de la carga." };
  await db(client, "bulk_import_job_events").insert({ job_id: job.data.id, event_type: "JOB_CREATED", metadata: { sourceHash, rowCount: preview.summary.total } });
  await db(client, "bulk_import_job_events").insert({ job_id: job.data.id, event_type: "PARSING_COMPLETE", metadata: { rowCount: preview.summary.total } });
  await db(client, "bulk_import_job_events").insert({ job_id: job.data.id, event_type: "NORMALIZATION_COMPLETE", metadata: { warningCount: preview.summary.warnings } });
  await db(client, "bulk_import_job_events").insert({ job_id: job.data.id, event_type: "VALIDATION_COMPLETE", metadata: { errorCount: preview.summary.errors } });
  await db(client, "bulk_import_job_events").insert({ job_id: job.data.id, event_type: "PRICING_COMPLETED", metadata: { rowCount: preview.summary.total } });
  await db(client, "bulk_import_job_events").insert({ job_id: job.data.id, event_type: "JOB_READY", metadata: { status: "READY_FOR_REVIEW" } });
  const rows = preview.rows.map((row) => ({ job_id: job.data.id, row_number: row.rowNumber, external_id: row.normalized.externalId, original_payload: row.original, normalized_payload: row.normalized, canonical_model_id: row.canonicalModelId, normalization_metadata: row.fields, validation_result: { issues: row.issues, modelCandidates: row.modelCandidates.map((candidate) => ({ id: candidate.id, name: candidate.modelName, modelYear: candidate.modelYear })) }, pricing_result: row.pricing, photo_metadata: row.photo, severity: row.severity }));
  const inserted = await db(client, "bulk_import_rows").insert(rows);
  if (inserted.error) return { ok: false as const, message: "No pudimos guardar el detalle de las filas." };
  return { ok: true as const, jobId: job.data.id, preview };
}

export async function listBulkImportHistory() {
  await requireCatalogManager("/operacion/carga-masiva/historial");
  const client = await createClient();
  const result = await db(client, "bulk_import_jobs").select("id, import_type, partner_profile_id, source_filename, status, row_count, ready_count, warning_count, error_count, created_at").order("created_at", { ascending: false }).limit(100);
  return result.data ?? [];
}

export async function getBulkImportJob(jobId: string) {
  await requireCatalogManager("/operacion/carga-masiva");
  const client = await createClient();
  const job = await db(client, "bulk_import_jobs").select("*").eq("id", jobId).maybeSingle();
  const rows = await db(client, "bulk_import_rows").select("*").eq("job_id", jobId).order("row_number");
  const rawRows = rows.data ?? [];
  const modelIds = rawRows.map((row: { canonical_model_id?: string | null }) => row.canonical_model_id).filter(Boolean);
  const models = modelIds.length ? await client.from("catalog_product_models").select("id,model_year").in("id", modelIds) : { data: [] };
  const years = new Map(((models.data ?? []) as unknown as Array<{ id: string; model_year: number | null }>).map((model) => [model.id, model.model_year]));
  return { job: job.data, rows: rawRows.map((row: { canonical_model_id?: string | null }) => ({ ...row, canonical_model_year: row.canonical_model_id ? years.get(row.canonical_model_id) ?? null : null })) };
}

async function requireReviewOperator() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || !(await canCurrentUserManageCatalog())) return { client, user: null };
  return { client, user };
}

export async function reviewBulkImportAction(formData: FormData) {
  const { client, user } = await requireReviewOperator();
  if (!user) return { ok: false as const, message: "No tienes autorización para revisar esta carga." };
  const action = String(formData.get("action") ?? "");
  const jobId = String(formData.get("jobId") ?? "");
  const rowId = String(formData.get("rowId") ?? "");
  if (!jobId) return { ok: false as const, message: "No encontramos esta carga." };
  if (action === "execute") {
    const result = await executeFirstPartyBulkImportAction(jobId);
    if (result.ok) revalidatePath(`/operacion/carga-masiva/${jobId}`);
    return result;
  }
  if (action === "approve" || action === "reopen") {
    const jobResult = await db(client, "bulk_import_jobs").select("id,status,import_type").eq("id", jobId).maybeSingle();
    if (jobResult.error || !jobResult.data) return { ok: false as const, message: "No encontramos esta carga." };
    if (action === "reopen") {
      if (jobResult.data.status !== "APPROVED_FOR_IMPORT") return { ok: false as const, message: "Sólo puedes reabrir una carga aprobada." };
      const updated = await db(client, "bulk_import_jobs").update({ status: "READY_FOR_REVIEW" }).eq("id", jobId);
      if (updated.error) return { ok: false as const, message: "No pudimos reabrir la revisión." };
      await db(client, "bulk_import_job_events").insert({ job_id: jobId, event_type: "JOB_REOPENED_FOR_REVIEW", metadata: { actorId: user.id } });
      return { ok: true as const, message: "La carga volvió a revisión." };
    }
    if (jobResult.data.status !== "READY_FOR_REVIEW") return { ok: false as const, message: "Esta carga no está lista para aprobación." };
    const rows = await db(client, "bulk_import_rows").select("id,severity,excluded,canonical_model_id,normalized_payload,pricing_result").eq("job_id", jobId);
    const modelIds = (rows.data ?? []).map((row: { canonical_model_id?: string | null }) => row.canonical_model_id).filter(Boolean);
    const models = modelIds.length ? await client.from("catalog_product_models").select("id,model_year").in("id", modelIds) : { data: [] };
    const years = new Map(((models.data ?? []) as unknown as Array<{ id: string; model_year: number | null }>).map((model) => [model.id, model.model_year]));
    const approvalRows = (rows.data ?? []).map((row: { canonical_model_id?: string | null; normalized_payload?: Record<string, unknown>; pricing_result?: Record<string, unknown> }) => ({ ...row, canonicalModelYear: row.canonical_model_id ? years.get(row.canonical_model_id) ?? null : null, normalizedModelYear: Number(row.normalized_payload?.modelYear) || null }));
    const included = approvalRows.filter((row: { excluded?: boolean }) => !row.excluded);
    const approval = canApproveBulkImport(approvalRows, { importType: jobResult.data.import_type });
    if (!approval.allowed) return { ok: false as const, message: approval.message };
    const updated = await db(client, "bulk_import_jobs").update({ status: "APPROVED_FOR_IMPORT", ready_count: included.length, error_count: 0 }).eq("id", jobId);
    if (updated.error) return { ok: false as const, message: "No pudimos aprobar la carga." };
    await db(client, "bulk_import_job_events").insert({ job_id: jobId, event_type: "JOB_APPROVED_FOR_IMPORT", metadata: { actorId: user.id, includedRows: included.length } });
    return { ok: true as const, message: "La carga fue aprobada para importación." };
  }
  if (!rowId) return { ok: false as const, message: "No encontramos esta fila." };
  const reviewJob = await db(client, "bulk_import_jobs").select("status,import_type").eq("id", jobId).maybeSingle();
  if (reviewJob.error || !reviewJob.data) return { ok: false as const, message: "No encontramos esta carga." };
  if (reviewJob.data.status !== "READY_FOR_REVIEW") return { ok: false as const, message: "Reabre la revisión antes de editar una fila." };
  const row = await db(client, "bulk_import_rows").select("id,job_id,canonical_model_id,normalization_metadata,normalized_payload,validation_result,pricing_result,manual_resolution,severity,excluded,original_payload").eq("id", rowId).eq("job_id", jobId).maybeSingle();
  if (row.error || !row.data) return { ok: false as const, message: "No encontramos esta fila." };
  const currentIssues = Array.isArray(row.data.validation_result?.issues) ? row.data.validation_result.issues : [];
  const invalidatePricing = { ...(row.data.pricing_result ?? {}), status: "INSUFFICIENT_DATA", proposedPriceMinor: null, marketReferenceMinor: null, estimatedPartnerNetMinor: null, viability: "Requiere nuevo análisis", reusedResearch: false, manualPriceApproved: false, manualOverride: false };
  const candidate = action === "resolve_model" ? (row.data.validation_result?.modelCandidates ?? []).find((item: { id?: string }) => item.id === String(formData.get("modelId") ?? "")) : null;
  let patch = action === "exclude"
    ? { excluded: true, exclusion_reason: String(formData.get("reason") ?? "Excluida durante revisión"), reviewed_by: user.id, reviewed_at: new Date().toISOString() }
    : action === "reinclude"
      ? { excluded: false, exclusion_reason: null, reviewed_by: user.id, reviewed_at: new Date().toISOString() }
      : action === "accept_normalization"
        ? { normalization_accepted: true, reviewed_by: user.id, reviewed_at: new Date().toISOString() }
        : action === "manual_resolution"
          ? { manual_resolution: { brand: String(formData.get("manualBrand") ?? ""), model: String(formData.get("manualModel") ?? ""), modelYear: String(formData.get("manualYear") ?? "") || null }, normalized_payload: { ...row.data.normalized_payload, brand: String(formData.get("manualBrand") ?? ""), model: String(formData.get("manualModel") ?? ""), modelYear: Number(formData.get("manualYear")) || null }, pricing_result: invalidatePricing, severity: "WARNING", reviewed_by: user.id, reviewed_at: new Date().toISOString() }
          : action === "resolve_model" && candidate
            ? { canonical_model_id: candidate.id, normalized_payload: { ...row.data.normalized_payload, model: candidate.name, modelYear: candidate.modelYear ?? row.data.normalized_payload.modelYear }, validation_result: { ...row.data.validation_result, issues: currentIssues.filter((issue: { code?: string }) => issue.code !== "AMBIGUOUS_MODEL_GENERATION" && issue.code !== "UNKNOWN_MODEL" && issue.code !== "MODEL_SUGGESTION") }, pricing_result: invalidatePricing, severity: "WARNING", reviewed_by: user.id, reviewed_at: new Date().toISOString() }
          : action === "use_canonical_year"
            ? { normalized_payload: { ...row.data.normalized_payload, modelYear: Number(formData.get("canonicalYear")) || null }, reviewed_by: user.id, reviewed_at: new Date().toISOString() }
          : action === "manual_price_resolution"
            ? { normalized_payload: { ...row.data.normalized_payload, askingPriceMinor: parseReviewedPrice(formData) }, pricing_result: { ...(row.data.pricing_result ?? {}), status: "COMPETITIVE", proposedPriceMinor: parseReviewedPrice(formData), approvedPriceMinor: parseReviewedPrice(formData), manualPriceApproved: true, manualOverride: true, manualPriceReason: String(formData.get("reason") ?? "Aprobación manual de precio"), viability: "Precio aprobado manualmente", stale: false }, manual_resolution: { ...(row.data.manual_resolution ?? {}), pricing: { approvedPriceMinor: parseReviewedPrice(formData), reason: String(formData.get("reason") ?? "Aprobación manual de precio"), actorId: user.id, source: "BULK_REVIEW" } }, reviewed_by: user.id, reviewed_at: new Date().toISOString() }
          : action === "edit_row"
            ? await buildReviewedRowPatch(client, row.data, formData, user.id)
          : null;
  if (action === "resolve_model" && !candidate) return { ok: false as const, message: "Selecciona una generación válida del catálogo." };
  if (action === "manual_price_resolution") {
    const approvedPriceMinor = parseReviewedPrice(formData);
    if (!Number.isSafeInteger(approvedPriceMinor) || approvedPriceMinor <= 0) return { ok: false as const, message: "Escribe un precio aprobado válido en centavos." };
  }
  if (action === "use_canonical_year" && !Number.isInteger(Number(formData.get("canonicalYear")))) return { ok: false as const, message: "No encontramos el año canónico." };
  if (!patch) return { ok: false as const, message: "Acción de revisión no reconocida." };
  if (action === "edit_row" && !patch) return { ok: false as const, message: "No pudimos interpretar los valores revisados." };
  const resultingPayload = (patch as Record<string, unknown>)?.normalized_payload as Record<string, unknown> | undefined ?? row.data.normalized_payload;
  const resultingPricing = (patch as Record<string, unknown>)?.pricing_result as Record<string, unknown> | undefined ?? row.data.pricing_result;
  if (action !== "exclude" && action !== "reinclude") {
    const canonicalId = (patch as Record<string, unknown>)?.canonical_model_id as string | undefined ?? row.data.canonical_model_id;
    let canonicalModelYear: number | null = null;
    if (canonicalId) {
      const model = await client.from("catalog_product_models").select("model_year").eq("id", canonicalId).maybeSingle();
      canonicalModelYear = (model.data as unknown as { model_year: number | null } | null)?.model_year ?? null;
    }
    const reconciliation = reconcileCurrentRowState({ importType: reviewJob.data.import_type, normalizedPayload: resultingPayload, pricingResult: resultingPricing, existingIssues: Array.isArray(row.data.validation_result?.issues) ? row.data.validation_result.issues : [], canonicalModelYear });
    patch = { ...patch, validation_result: { ...(row.data.validation_result ?? {}), issues: reconciliation.issues }, severity: reconciliation.severity } as typeof patch;
  }
  const updated = await db(client, "bulk_import_rows").update(patch as Record<string, unknown>).eq("id", rowId).eq("job_id", jobId);
  if (updated.error) return { ok: false as const, message: "No pudimos actualizar la fila." };
  const eventType = action === "exclude" ? "ROW_EXCLUDED" : action === "reinclude" ? "ROW_REINCLUDED" : action === "accept_normalization" ? "NORMALIZATION_ACCEPTED" : action === "resolve_model" ? "MODEL_RESOLVED" : "ROW_CORRECTED";
  await db(client, "bulk_import_job_events").insert({ job_id: jobId, event_type: eventType, metadata: { actorId: user.id, rowId, action, source: "BULK_REVIEW" } });
  return { ok: true as const, message: action === "exclude" ? "La fila fue excluida." : action === "reinclude" ? "La fila fue reincluida." : "La fila fue actualizada." };
}

export async function executeFirstPartyBulkImportAction(jobId: string) {
  const { client, user } = await requireReviewOperator();
  if (!user) return { ok: false as const, message: "No tienes autorización para importar inventario." };
  const job = await db(client, "bulk_import_jobs").select("id,status,import_type").eq("id", jobId).maybeSingle();
  if (job.error || !job.data) return { ok: false as const, message: "No encontramos esta carga." };
  if (job.data.import_type !== "FIRST_PARTY") return { ok: false as const, message: "Esta carga corresponde a un Partner y no puede importarse desde este flujo." };
  if (!["APPROVED_FOR_IMPORT", "PARTIALLY_IMPORTED", "FAILED_IMPORT"].includes(job.data.status)) return { ok: false as const, message: "La carga debe estar aprobada para importar." };
  // Generated Supabase types are refreshed after the staging migration lands.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (client as any).rpc("execute_first_party_bulk_import", { requested_job_id: jobId });
  if (result.error || !result.data) {
    console.error("bulk_import_execution_failed", { jobId, actorId: user.id, code: result.error?.code, message: result.error?.message });
    return { ok: false as const, message: "No pudimos importar esta carga. Revisa las filas e inténtalo de nuevo." };
  }
  revalidatePath(`/operacion/carga-masiva/${jobId}`);
  revalidatePath("/operacion/catalogo");
  revalidatePath("/operacion/inventario");
  const summary = result.data as { status?: string; imported?: number; skipped?: number; failed?: number };
  return { ok: true as const, message: summary.status === "IMPORTED" ? "La importación se completó correctamente." : "La importación terminó con algunas filas pendientes.", summary };
}

export async function discardBulkImportJob(jobId: string) {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { ok: false as const, message: "No tienes autorización para descartar esta carga." };
  const authorized = await canCurrentUserManageCatalog();
  console.info("bulk_import_discard_attempt", { jobId, actorId: user.id, authorized });
  if (!authorized) return { ok: false as const, message: "No tienes autorización para descartar esta carga." };
  const jobResult = await db(client, "bulk_import_jobs")
    .select("id, status, partner_profile_id")
    .eq("id", jobId)
    .maybeSingle();
  if (jobResult.error || !jobResult.data) {
    console.warn("bulk_import_discard_lookup_failed", { jobId, actorId: user.id, code: jobResult.error?.code ?? "NOT_FOUND", message: jobResult.error?.message ?? "not found" });
    return { ok: false as const, message: "No encontramos esta carga." };
  }
  const decision = canDiscardBulkImportJob({
    status: jobResult.data.status,
    partnerProfileId: jobResult.data.partner_profile_id,
    finalDomainWriteState: null,
  }, { isOperator: true });
  if (!decision.allowed) {
    console.info("bulk_import_discard_denied", { jobId, actorId: user.id, status: jobResult.data.status, code: decision.code });
    return { ok: false as const, message: decision.message };
  }
  // FK ON DELETE CASCADE removes rows, issues and events. PR82 stores no blobs;
  // CSV/error exports are transient and generated on demand.
  const deleted = await db(client, "bulk_import_jobs").delete().eq("id", jobId);
  if (deleted.error) {
    console.error("bulk_import_discard_delete_failed", { jobId, actorId: user.id, status: jobResult.data.status, code: deleted.error.code, message: deleted.error.message, details: deleted.error.details });
    return { ok: false as const, message: "No pudimos descartar la carga. Inténtalo de nuevo." };
  }
  console.info("bulk_import_discard_succeeded", { jobId, actorId: user.id, status: jobResult.data.status });
  return { ok: true as const, message: "La carga fue descartada correctamente." };
}
