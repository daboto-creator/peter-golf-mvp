"use server";

import { createHash, randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { serverEnv } from "@/env/server";
import { getIdentityVerificationProvider } from "@/lib/identity-verification/provider";
import { csfPartnerMessage } from "@/lib/identity-verification/csf-analysis";
import { analyzeCsfDocument } from "@/lib/identity-verification/csf-document-extractor";
import {
  requireMarketplacePartner,
  requireMarketplaceUser,
  requirePartnerManager,
} from "@/lib/auth/marketplace-authorization";
import type { PartnerActionState } from "@/lib/marketplace/partner-action-state";
import {
  identityOnboardingNextRoute,
  resolveIdentityOnboardingState,
} from "@/lib/marketplace/identity-onboarding";
import {
  PARTNER_KYC_BUCKET,
  basicPartnerSchema,
  documentKindCopy,
  fiscalPartnerSchema,
  legalTypeSchema,
  partnerDocumentPath,
  validateFiscalInformation,
  validatePartnerDocument,
  validatePartnerDocumentSignature,
} from "@/lib/marketplace/partner-rules";
import {
  AutomaticDocumentAnalysisPersistenceError,
  persistAutomaticPartnerDocumentAnalysis,
} from "@/lib/supabase/service-role";

function value(formData: FormData, key: string): string {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry : "";
}

function friendlyFailure(message: string): PartnerActionState {
  if (message.includes("version conflict"))
    return {
      status: "error",
      message:
        "La información cambió en otra sesión. Actualiza la página e inténtalo de nuevo.",
    };
  if (message.includes("disabled"))
    return {
      status: "error",
      message: "El programa Partner no está disponible en este momento.",
    };
  if (message.includes("access denied") || message.includes("permission"))
    return {
      status: "error",
      message: "No tienes permiso para realizar esta acción.",
    };
  return {
    status: "error",
    message: "No pudimos guardar los cambios. Inténtalo de nuevo.",
  };
}

export async function setExperienceModeAction(
  formData: FormData,
): Promise<void> {
  const mode = value(formData, "mode");
  if (mode !== "golfer" && mode !== "partner") return;
  const cookieStore = await cookies();
  cookieStore.set("brps-mode", mode, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect(mode === "partner" ? "/partner" : "/cuenta");
}

export async function startPartnerAction(
  _previous: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const parsed = legalTypeSchema.safeParse(value(formData, "legalType"));
  if (!parsed.success)
    return { status: "error", message: "Selecciona el tipo de Partner." };
  const { client } = await requireMarketplaceUser("/partner/onboarding");
  const result = await client.rpc("register_partner_profile", {
    requested_legal_type: parsed.data,
  });
  if (result.error) return friendlyFailure(result.error.message);
  revalidatePath("/cuenta");
  revalidatePath("/partner");
  redirect("/partner/onboarding/datos");
}

export async function saveBasicPartnerAction(
  _previous: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const { client, partner } = await requireMarketplacePartner(
    "/partner/onboarding/datos",
  );
  const parsed = basicPartnerSchema.safeParse({
    first_name: value(formData, "first_name"),
    last_name: value(formData, "last_name"),
    phone: value(formData, "phone"),
    country_code: value(formData, "country_code").toUpperCase(),
    state: value(formData, "state"),
    city: value(formData, "city"),
    commercial_name: value(formData, "commercial_name"),
    representative_name: value(formData, "representative_name"),
  });
  const termsAccepted = formData.get("terms_accepted") === "on";
  const privacyAccepted = formData.get("privacy_accepted") === "on";
  if (!termsAccepted || !privacyAccepted)
    return {
      status: "error",
      message: "Debes aceptar los términos y el aviso de privacidad.",
    };
  if (!parsed.success)
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revisa la información.",
    };
  const result = await client.rpc("save_partner_onboarding", {
    expected_version: partner.version,
    requested_section: "basic",
    requested_payload: {
      firstName: parsed.data.first_name,
      lastName: parsed.data.last_name,
      phone: parsed.data.phone,
      countryCode: parsed.data.country_code,
      state: parsed.data.state,
      city: parsed.data.city,
      commercialName: parsed.data.commercial_name,
      representativeName: parsed.data.representative_name,
    },
  });
  if (result.error) return friendlyFailure(result.error.message);
  const consent = await client.rpc("record_partner_onboarding_consents", {
    expected_version: result.data.version,
    requested_terms_accepted: true,
    requested_privacy_accepted: true,
  });
  if (consent.error) return friendlyFailure(consent.error.message);
  revalidatePath("/partner", "layout");
  redirect("/partner/onboarding/identidad");
}

export async function startIdentityVerificationAction(
  _previous: PartnerActionState,
  _formData: FormData,
): Promise<PartnerActionState> {
  void _previous;
  void _formData;
  const { client, partner, user } = await requireMarketplacePartner(
    "/partner/onboarding/identidad",
  );
  const latestVerification = await client
    .from("partner_identity_verifications")
    .select("result")
    .eq("partner_id", partner.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestVerification.error)
    return {
      status: "error",
      message: "No pudimos consultar tu verificación. Inténtalo nuevamente.",
    };
  const onboardingState = resolveIdentityOnboardingState(
    latestVerification.data?.result,
  );
  if (onboardingState.shouldAdvance) {
    redirect(identityOnboardingNextRoute(partner.legal_type));
  }
  if (!onboardingState.canStart) {
    return {
      status: "success",
      message: onboardingState.message ?? "Tu verificación ya está en proceso.",
    };
  }
  const provider = getIdentityVerificationProvider();
  if (!provider)
    return {
      status: "error",
      message:
        "La verificación de identidad aún no está configurada en este entorno.",
    };
  let verificationUrl: string;
  try {
    const session = await provider.createSession({
      partnerId: partner.id,
      kind: partner.legal_type === "LEGAL_ENTITY" ? "BUSINESS" : "PERSON",
      callbackUrl: `${serverEnv.NEXT_PUBLIC_APP_URL}/partner/onboarding/identidad`,
      email: user.email,
      phone: partner.phone,
    });
    const registration = await client.rpc("register_partner_identity_session", {
      requested_provider: session.provider,
      requested_external_session_id: session.externalSessionId,
      requested_session_kind:
        partner.legal_type === "LEGAL_ENTITY" ? "BUSINESS" : "PERSON",
    });
    if (registration.error) return friendlyFailure(registration.error.message);
    verificationUrl = session.verificationUrl;
  } catch {
    return {
      status: "error",
      message: "No pudimos iniciar la verificación. Inténtalo nuevamente.",
    };
  }
  redirect(verificationUrl);
}

export async function saveFiscalPartnerAction(
  _previous: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const { client, partner } = await requireMarketplacePartner(
    "/partner/onboarding/fiscal",
  );
  const parsed = fiscalPartnerSchema.safeParse({
    tax_id: value(formData, "tax_id").toUpperCase(),
    legal_name: value(formData, "legal_name"),
    fiscal_address_line_1: value(formData, "fiscal_address_line_1"),
    fiscal_address_line_2: value(formData, "fiscal_address_line_2"),
    fiscal_city: value(formData, "fiscal_city"),
    fiscal_state: value(formData, "fiscal_state"),
    fiscal_postal_code: value(formData, "fiscal_postal_code"),
  });
  if (!parsed.success)
    return { status: "error", message: "Revisa la información fiscal." };
  const validation = validateFiscalInformation(partner.legal_type, parsed.data);
  if (validation) return { status: "error", message: validation };
  const result = await client.rpc("save_partner_onboarding", {
    expected_version: partner.version,
    requested_section: "fiscal",
    requested_payload: {
      taxId: parsed.data.tax_id,
      legalName: parsed.data.legal_name,
      fiscalAddressLine1: parsed.data.fiscal_address_line_1,
      fiscalAddressLine2: parsed.data.fiscal_address_line_2,
      fiscalCity: parsed.data.fiscal_city,
      fiscalState: parsed.data.fiscal_state,
      fiscalPostalCode: parsed.data.fiscal_postal_code,
    },
  });
  if (result.error) return friendlyFailure(result.error.message);
  revalidatePath("/partner", "layout");
  redirect("/partner/onboarding/documentos");
}

export async function uploadPartnerDocumentAction(
  _previous: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const { client, partner } = await requireMarketplacePartner(
    "/partner/onboarding/documentos",
  );
  const kind = value(formData, "document_kind");
  const file = formData.get("document");
  if (!(kind in documentKindCopy))
    return { status: "error", message: "Selecciona el tipo de documento." };
  if (!(file instanceof File))
    return { status: "error", message: "Selecciona un documento." };
  const metadataError = validatePartnerDocument(file);
  if (metadataError) return { status: "error", message: metadataError };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validatePartnerDocumentSignature(file.type, bytes.slice(0, 12)))
    return {
      status: "error",
      message: "El contenido no coincide con el formato declarado.",
    };
  const documentId = randomUUID();
  const storagePath = partnerDocumentPath(partner.id, documentId, file.type);
  if (!storagePath)
    return { status: "error", message: "No pudimos preparar una ruta segura." };
  const upload = await client.storage
    .from(PARTNER_KYC_BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (upload.error) return friendlyFailure(upload.error.message);
  const registration = await client.rpc("register_partner_document", {
    requested_document_id: documentId,
    requested_document_kind: kind,
    requested_storage_path: storagePath,
    requested_mime_type: file.type,
    requested_size_bytes: file.size,
    requested_sha256: createHash("sha256").update(bytes).digest("hex"),
  });
  if (registration.error) {
    await client.storage.from(PARTNER_KYC_BUCKET).remove([storagePath]);
    return friendlyFailure(registration.error.message);
  }
  await client.rpc("save_partner_onboarding", {
    expected_version: partner.version,
    requested_section: "documents",
    requested_payload: {},
  });
  let documentMessage = "Documento recibido de forma segura.";
  if (
    kind === "fiscal_certificate" &&
    (partner.legal_type === "SOLE_PROPRIETOR" ||
      partner.legal_type === "LEGAL_ENTITY")
  ) {
    try {
      const analysis = await analyzeCsfDocument({
        bytes,
        mimeType: file.type,
        legalType: partner.legal_type,
        registeredRfc: partner.tax_id,
        registeredName: partner.legal_name,
      });
      await persistAutomaticPartnerDocumentAnalysis({
        documentId,
        actorId: partner.user_id,
        result: analysis.result,
        extractedName: analysis.extractedName,
        extractedRfc: analysis.extractedRfc,
        officialQrDestination: analysis.officialQrDestination,
        warningCodes: analysis.warningCodes,
        normalizedOutput: {
          extractionSource: analysis.extractionSource,
          parseConfidence: analysis.confidence,
          qrStatus: analysis.qrStatus,
          qrRfc: analysis.qrRfc,
          rfcMatches: analysis.rfcMatches,
          nameMatches: analysis.nameMatches,
        },
      });
      documentMessage = csfPartnerMessage(analysis.result);
    } catch (error) {
      console.error("marketplace_csf_analysis_failed", {
        stage:
          error instanceof AutomaticDocumentAnalysisPersistenceError
            ? "persistence"
            : "extraction",
        code:
          error instanceof AutomaticDocumentAnalysisPersistenceError &&
          error.code?.match(/^[A-Z0-9]{5,10}$/)
            ? error.code
            : undefined,
      });
      await persistAutomaticPartnerDocumentAnalysis({
        documentId,
        actorId: partner.user_id,
        result: "REVIEW_REQUIRED",
        extractedName: null,
        extractedRfc: null,
        officialQrDestination: null,
        warningCodes: ["CSF_ANALYSIS_ERROR"],
        normalizedOutput: {
          extractionSource: "UNAVAILABLE",
          qrStatus: "NOT_AVAILABLE",
          rfcMatches: null,
          nameMatches: null,
        },
      }).catch(() => undefined);
      documentMessage = csfPartnerMessage("REVIEW_REQUIRED");
    }
  }
  revalidatePath("/partner", "layout");
  return { status: "success", message: documentMessage };
}

export async function submitPartnerAction(
  _previous: PartnerActionState,
  _formData: FormData,
): Promise<PartnerActionState> {
  void _previous;
  void _formData;
  const { client, partner } = await requireMarketplacePartner(
    "/partner/onboarding/revision",
  );
  const result = await client.rpc("submit_partner_for_review", {
    expected_version: partner.version,
  });
  if (result.error)
    return result.error.message.includes("not ready")
      ? {
          status: "error",
          message:
            "Completa la información y agrega al menos un documento antes de enviar.",
        }
      : friendlyFailure(result.error.message);
  revalidatePath("/partner", "layout");
  redirect("/partner");
}

export async function reviewPartnerDocumentAction(
  _previous: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const documentId = z.uuid().safeParse(value(formData, "document_id"));
  const status = z
    .enum(["UNDER_REVIEW", "VERIFIED", "REJECTED"])
    .safeParse(value(formData, "status"));
  const reason = value(formData, "reason").trim();
  const version = z.coerce
    .number()
    .int()
    .positive()
    .safeParse(value(formData, "version"));
  if (
    !documentId.success ||
    !status.success ||
    !version.success ||
    reason.length < 3
  )
    return {
      status: "error",
      message: "Selecciona una decisión y escribe un motivo claro.",
    };
  const { client } = await requirePartnerManager(
    "/operacion/marketplace/partners",
  );
  const result = await client.rpc("review_partner_document", {
    requested_document_id: documentId.data,
    expected_version: version.data,
    requested_status: status.data,
    requested_reason: reason,
  });
  if (result.error) return friendlyFailure(result.error.message);
  revalidatePath("/operacion/marketplace/partners", "layout");
  return { status: "success", message: "Revisión de documento guardada." };
}

export async function transitionPartnerStatusAction(
  _previous: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  const partnerId = z.uuid().safeParse(value(formData, "partner_id"));
  const version = z.coerce
    .number()
    .int()
    .positive()
    .safeParse(value(formData, "version"));
  const status = z
    .enum([
      "IDENTITY_PENDING",
      "UNDER_REVIEW",
      "VERIFIED",
      "SUSPENDED",
      "REJECTED",
    ])
    .safeParse(value(formData, "status"));
  const reason = value(formData, "reason").trim();
  if (
    !partnerId.success ||
    !version.success ||
    !status.success ||
    reason.length < 3
  )
    return {
      status: "error",
      message: "Selecciona una transición válida y escribe un motivo.",
    };
  const { client } = await requirePartnerManager(
    `/operacion/marketplace/partners/${partnerId.data}`,
  );
  const result = await client.rpc("transition_partner_status", {
    requested_partner_id: partnerId.data,
    expected_version: version.data,
    requested_status: status.data,
    requested_reason: reason,
  });
  if (result.error) return friendlyFailure(result.error.message);
  revalidatePath(`/operacion/marketplace/partners/${partnerId.data}`);
  revalidatePath("/operacion/marketplace/partners");
  return { status: "success", message: "Estado Partner actualizado." };
}
