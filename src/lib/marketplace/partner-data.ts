import "server-only";

import type { PartnerStatus } from "@/lib/marketplace/partner-rules";
import { createClient } from "@/lib/supabase/server";

export async function getCurrentPartnerContext() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return {
      user: null,
      partner: null,
      readiness: null,
      documents: [],
      identityVerifications: [],
      documentAnalyses: [],
    };
  const { data: partner } = await client
    .from("partner_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!partner)
    return {
      user,
      partner: null,
      readiness: null,
      documents: [],
      identityVerifications: [],
      documentAnalyses: [],
    };
  const [readinessResult, documentsResult, identityResult, analysesResult] =
    await Promise.all([
      client
        .rpc("get_partner_onboarding_readiness", {
          requested_partner_id: partner.id,
        })
        .maybeSingle(),
      client
        .from("partner_documents")
        .select(
          "id, document_kind, mime_type, size_bytes, status, review_reason, created_at, updated_at, version",
        )
        .eq("partner_id", partner.id)
        .order("created_at", { ascending: false }),
      client
        .from("partner_identity_verifications")
        .select(
          "id, provider, session_kind, result, warning_codes, liveness_passed, face_match_passed, completed_at, created_at",
        )
        .eq("partner_id", partner.id)
        .order("created_at", { ascending: false }),
      client
        .from("partner_document_analyses")
        .select("id, document_id, result, warning_codes, analyzed_at")
        .order("analyzed_at", { ascending: false }),
    ]);
  return {
    user,
    partner,
    readiness: readinessResult.data,
    documents: documentsResult.data ?? [],
    identityVerifications: identityResult.data ?? [],
    documentAnalyses: analysesResult.data ?? [],
  };
}

export async function getProfileDefaults(userId: string) {
  const client = await createClient();
  const { data } = await client
    .from("profiles")
    .select("first_name, last_name, phone")
    .eq("id", userId)
    .maybeSingle();
  return data;
}

export async function listPartnersForOperations(
  page: number,
  status?: PartnerStatus,
) {
  const client = await createClient();
  const pageSize = 20;
  const start = (page - 1) * pageSize;
  let query = client
    .from("partner_profiles")
    .select(
      "id, legal_type, status, commercial_name, first_name, last_name, created_at, updated_at, partner_documents(status)",
      { count: "exact" },
    )
    .order("updated_at", { ascending: false })
    .range(start, start + pageSize - 1);
  if (status) query = query.eq("status", status);
  const result = await query;
  return {
    data: result.data ?? [],
    count: result.count ?? 0,
    error: result.error,
    page,
    pageSize,
  };
}

export async function getPartnerForOperations(partnerId: string) {
  const client = await createClient();
  const [partner, documents, history, identity, analyses] = await Promise.all([
    client
      .from("partner_profiles")
      .select("*")
      .eq("id", partnerId)
      .maybeSingle(),
    client
      .from("partner_documents")
      .select(
        "id, document_kind, mime_type, size_bytes, status, review_reason, reviewed_at, created_at, version",
      )
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false }),
    client
      .from("partner_status_history")
      .select("id, from_status, to_status, reason, created_at, version")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false }),
    client
      .from("partner_identity_verifications")
      .select(
        "id, provider, session_kind, result, normalized_attributes, warning_codes, liveness_passed, face_match_passed, completed_at, created_at",
      )
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false }),
    client
      .from("partner_document_analyses")
      .select(
        "id, document_id, result, extracted_document_type, extracted_name, extracted_address, extracted_document_date, extracted_rfc, official_qr_destination, normalized_output, warning_codes, analyzed_at, partner_documents!inner(partner_id)",
      )
      .eq("partner_documents.partner_id", partnerId)
      .order("analyzed_at", { ascending: false }),
  ]);
  return {
    partner: partner.data,
    documents: documents.data ?? [],
    history: history.data ?? [],
    identity: identity.data ?? [],
    analyses: analyses.data ?? [],
    error: partner.error,
  };
}
