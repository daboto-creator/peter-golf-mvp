"use server";

import { createHash } from "node:crypto";
import { canCurrentUserManageCatalog, requireCatalogManager } from "@/lib/auth/catalog-authorization";
import { listActiveGolfCatalogReferences } from "@/lib/catalog/operational-products";
import { buildBulkPreview } from "./preview";
import type { BulkImportType, CatalogModelReference } from "./types";
import { createClient } from "@/lib/supabase/server";
import { canDiscardBulkImportJob } from "./discard-policy";

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
  const rows = preview.rows.map((row) => ({ job_id: job.data.id, row_number: row.rowNumber, external_id: row.normalized.externalId, original_payload: row.original, normalized_payload: row.normalized, canonical_model_id: row.canonicalModelId, normalization_metadata: row.fields, validation_result: { issues: row.issues }, pricing_result: row.pricing, photo_metadata: row.photo, severity: row.severity }));
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
  return { job: job.data, rows: rows.data ?? [] };
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
