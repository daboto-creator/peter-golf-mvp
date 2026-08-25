import { z } from "zod";

import type { Database } from "@/types/database.types";

export type PartnerLegalType =
  Database["public"]["Enums"]["partner_legal_type"];
export type PartnerStatus = Database["public"]["Enums"]["partner_status"];
export type PartnerDocumentStatus =
  Database["public"]["Enums"]["partner_document_status"];

export const PARTNER_KYC_BUCKET = "partner-kyc";
export const MAX_PARTNER_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const partnerStatusCopy: Record<
  PartnerStatus,
  { label: string; description: string }
> = {
  REGISTERED: {
    label: "Completa tu perfil",
    description: "Cuéntanos lo esencial para preparar tu verificación.",
  },
  IDENTITY_PENDING: {
    label: "Completa tu verificación",
    description: "Revisa tus datos y documentos antes de enviarlos.",
  },
  UNDER_REVIEW: {
    label: "Estamos revisando tu información",
    description: "Best Round revisará tu solicitud y documentos.",
  },
  VERIFIED: {
    label: "Partner verificado",
    description: "Tu cuenta Best Round Partner está verificada.",
  },
  SUSPENDED: {
    label: "Cuenta Partner suspendida",
    description: "Tu información se conserva mientras revisamos tu cuenta.",
  },
  REJECTED: {
    label: "Solicitud no aprobada",
    description: "Tu cuenta Golfer continúa funcionando normalmente.",
  },
};

export function isPartnerStatus(value: string): value is PartnerStatus {
  return value in partnerStatusCopy;
}

export const legalTypeCopy: Record<
  PartnerLegalType,
  { label: string; description: string }
> = {
  INDIVIDUAL: {
    label: "Particular",
    description: "Para vender equipo propio de forma ocasional.",
  },
  SOLE_PROPRIETOR: {
    label: "Persona física con actividad empresarial",
    description: "Para una actividad comercial registrada a tu nombre.",
  },
  LEGAL_ENTITY: {
    label: "Empresa / persona moral",
    description: "Para una empresa constituida y su representante.",
  },
};

export const documentKindCopy = {
  identification: "Identificación",
  tax_document: "Documento fiscal",
  company_document: "Documento de empresa",
  address_proof: "Comprobante",
  other: "Otro documento",
} as const;

export const partnerDocumentStatusCopy: Record<PartnerDocumentStatus, string> =
  {
    UPLOADED: "Recibido",
    UNDER_REVIEW: "En revisión",
    VERIFIED: "Aprobado",
    REJECTED: "Requiere actualización",
  };

export type PartnerDocumentKind = keyof typeof documentKindCopy;

export const legalTypeSchema = z.enum([
  "INDIVIDUAL",
  "SOLE_PROPRIETOR",
  "LEGAL_ENTITY",
]);

const optionalRangedText = (min: number, max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => value.length === 0 || value.length >= min)
    .transform((value) => value || null);

export const basicPartnerSchema = z
  .object({
    first_name: optionalRangedText(1, 80),
    last_name: optionalRangedText(1, 80),
    phone: optionalRangedText(7, 30),
    country_code: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/),
    state: optionalRangedText(2, 100),
    city: optionalRangedText(2, 100),
    commercial_name: optionalRangedText(2, 160),
    representative_name: optionalRangedText(2, 160),
  })
  .superRefine((value, context) => {
    const personComplete = value.first_name && value.last_name;
    const companyComplete = value.commercial_name && value.representative_name;
    if (!personComplete && !companyComplete) {
      context.addIssue({
        code: "custom",
        message: "Completa el nombre de la persona o los datos de la empresa.",
      });
    }
    if (!value.phone || !value.state || !value.city) {
      context.addIssue({
        code: "custom",
        message: "Completa teléfono, estado y ciudad.",
      });
    }
  });

export const fiscalPartnerSchema = z.object({
  tax_id: z
    .string()
    .trim()
    .toUpperCase()
    .refine(
      (value) => !value || /^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(value),
    )
    .transform((value) => value || null),
  legal_name: optionalRangedText(2, 200),
  fiscal_address_line_1: optionalRangedText(5, 200),
  fiscal_address_line_2: optionalRangedText(1, 120),
  fiscal_city: optionalRangedText(2, 100),
  fiscal_state: optionalRangedText(2, 100),
  fiscal_postal_code: z
    .string()
    .trim()
    .refine((value) => !value || /^[0-9]{5}$/.test(value))
    .transform((value) => value || null),
});

export function validateFiscalInformation(
  legalType: PartnerLegalType,
  value: z.infer<typeof fiscalPartnerSchema>,
): string | null {
  if (legalType === "INDIVIDUAL") return null;
  if (
    !value.tax_id ||
    !value.legal_name ||
    !value.fiscal_address_line_1 ||
    !value.fiscal_city ||
    !value.fiscal_state ||
    !value.fiscal_postal_code
  ) {
    return "Completa la información fiscal básica para continuar.";
  }
  return null;
}

const documentTypes = {
  "application/pdf": { extension: "pdf", signature: [0x25, 0x50, 0x44, 0x46] },
  "image/jpeg": { extension: "jpg", signature: [0xff, 0xd8, 0xff] },
  "image/png": {
    extension: "png",
    signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  "image/webp": {
    extension: "webp",
    signature: [0x52, 0x49, 0x46, 0x46],
  },
} as const;

export function validatePartnerDocument(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  if (!(file.type in documentTypes)) {
    return "Usa un archivo PDF, JPEG, PNG o WebP.";
  }
  if (file.size < 1 || file.size > MAX_PARTNER_DOCUMENT_BYTES) {
    return "El documento debe pesar más de 0 bytes y máximo 10 MiB.";
  }
  const configured = documentTypes[file.type as keyof typeof documentTypes];
  const extension = file.name.split(".").pop()?.toLowerCase();
  const accepted =
    configured.extension === "jpg" ? ["jpg", "jpeg"] : [configured.extension];
  return extension && accepted.includes(extension)
    ? null
    : "La extensión no coincide con el tipo de archivo.";
}

export function validatePartnerDocumentSignature(
  mimeType: string,
  bytes: Uint8Array,
): boolean {
  if (!(mimeType in documentTypes)) return false;
  const signature =
    documentTypes[mimeType as keyof typeof documentTypes].signature;
  if (!signature.every((value, index) => bytes[index] === value)) return false;
  return (
    mimeType !== "image/webp" ||
    (bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50)
  );
}

export function partnerDocumentPath(
  partnerId: string,
  documentId: string,
  mimeType: string,
): string | null {
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  if (
    !uuid.test(partnerId) ||
    !uuid.test(documentId) ||
    !(mimeType in documentTypes)
  )
    return null;
  const extension =
    documentTypes[mimeType as keyof typeof documentTypes].extension;
  return `partners/${partnerId}/${documentId}.${extension}`;
}

export function isPartnerReadOnly(status: PartnerStatus): boolean {
  return ["UNDER_REVIEW", "VERIFIED", "SUSPENDED", "REJECTED"].includes(status);
}

export function normalizePartnerMode(
  value: string | undefined,
): "golfer" | "partner" {
  return value === "partner" ? "partner" : "golfer";
}

export function getNextExperienceMode(
  mode: "golfer" | "partner",
): "golfer" | "partner" {
  return mode === "partner" ? "golfer" : "partner";
}

export function getOnboardingCompletion(readiness: {
  basic_complete: boolean;
  fiscal_complete: boolean;
  documents_complete: boolean;
  review_ready: boolean;
}): { completed: number; total: 4; percentage: number } {
  const completed = [
    readiness.basic_complete,
    readiness.fiscal_complete,
    readiness.documents_complete,
    readiness.review_ready,
  ].filter(Boolean).length;
  return { completed, total: 4, percentage: completed * 25 };
}
