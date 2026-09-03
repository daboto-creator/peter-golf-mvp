import "server-only";

import { createClient } from "@supabase/supabase-js";

import { serverEnv } from "@/env/server";
import type { StripeWebhookRpcInput } from "@/lib/stripe/webhook-processing";
import {
  isPermanentStripeWebhookDatabaseError,
  toStripeWebhookRpcArgs,
} from "@/lib/stripe/webhook-rpc";
import type { Database } from "@/types/database.types";

export function createServiceRoleClient() {
  const url = serverEnv.NEXT_PUBLIC_SUPABASE_URL;
  const key = serverEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("Service-role configuration is unavailable.");
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function processStripeWebhookEvent(input: StripeWebhookRpcInput) {
  const url = serverEnv.NEXT_PUBLIC_SUPABASE_URL;
  const key = serverEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (serverEnv.STRIPE_CHECKOUT_MODE !== "test" || !url || !key) {
    throw new Error("Stripe webhook database configuration is unavailable.");
  }

  const client = createServiceRoleClient();
  const { data, error } = await client
    .rpc("process_stripe_webhook_event", toStripeWebhookRpcArgs(input))
    .single();
  if (error || !data) {
    const code = error?.code;
    const hintCode = error?.hint;
    const permanent = isPermanentStripeWebhookDatabaseError(code, hintCode);
    throw new StripeWebhookDatabaseError(!permanent, code, hintCode);
  }
  return data;
}

export async function processPartnerIdentityWebhook(input: {
  provider: string;
  eventId: string;
  externalSessionId: string;
  result: Database["public"]["Enums"]["identity_verification_result"];
  attributes: Record<string, string | boolean>;
  warningCodes: string[];
  occurredAt: string;
  payloadSha256: string;
}) {
  const client = createServiceRoleClient();
  const { data, error } = await client.rpc("process_partner_identity_webhook", {
    requested_provider: input.provider,
    requested_event_id: input.eventId,
    requested_external_session_id: input.externalSessionId,
    requested_result: input.result,
    requested_attributes: input.attributes,
    requested_warning_codes: input.warningCodes,
    requested_occurred_at: input.occurredAt,
    requested_payload_sha256: input.payloadSha256,
  });
  if (error) throw new Error("Identity webhook database processing failed.");
  return data;
}

export async function persistAutomaticPartnerDocumentAnalysis(input: {
  documentId: string;
  actorId: string;
  result: Database["public"]["Enums"]["automatic_document_review_result"];
  extractedName: string | null;
  extractedRfc: string | null;
  officialQrDestination: string | null;
  warningCodes: string[];
  normalizedOutput: Database["public"]["Tables"]["partner_document_analyses"]["Row"]["normalized_output"];
  analysisVersion?: string;
  documentType?: string | null;
  extractedAddress?: string | null;
  extractedDocumentDate?: string | null;
}) {
  const client = createServiceRoleClient();
  const { error } = await client.rpc(
    "record_automatic_partner_document_analysis",
    {
      requested_document_id: input.documentId,
      requested_actor_id: input.actorId,
      requested_analysis_version: input.analysisVersion ?? "rules-v1",
      requested_result: input.result,
      requested_extracted: {
        name: input.extractedName,
        rfc: input.extractedRfc,
        officialQrDestination: input.officialQrDestination,
        documentType: input.documentType,
        address: input.extractedAddress,
        documentDate: input.extractedDocumentDate,
      },
      requested_warning_codes: input.warningCodes,
      requested_normalized_output: input.normalizedOutput,
    },
  );
  if (error) {
    throw new AutomaticDocumentAnalysisPersistenceError(error.code);
  }
}

export class AutomaticDocumentAnalysisPersistenceError extends Error {
  constructor(readonly code?: string) {
    super("Automatic document analysis persistence failed.");
    this.name = "AutomaticDocumentAnalysisPersistenceError";
  }
}

export class StripeWebhookDatabaseError extends Error {
  constructor(
    readonly retryable: boolean,
    readonly code?: string,
    readonly hintCode?: string,
  ) {
    super("Stripe webhook processing failed.");
    this.name = "StripeWebhookDatabaseError";
  }
}
