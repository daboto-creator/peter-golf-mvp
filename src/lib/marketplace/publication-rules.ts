export const MARKETPLACE_SOURCE = "MARKETPLACE_PARTNER" as const;
export const FIRST_PARTY_SOURCE = "FIRST_PARTY" as const;

export type ProductSource =
  typeof FIRST_PARTY_SOURCE | typeof MARKETPLACE_SOURCE;

export const productSourceLabel: Record<ProductSource, string> = {
  FIRST_PARTY: "Producto Best Round",
  MARKETPLACE_PARTNER: "Best Round Partner verificado",
};

export const MARKETPLACE_BUYER_BADGE = "Best Round Partner verificado";

export const publicationBlockerCopy: Record<string, string> = {
  MARKETPLACE_DISABLED: "Marketplace está desactivado.",
  PARTNER_NOT_VERIFIED: "El Partner no está verificado.",
  LISTING_NOT_APPROVED: "La publicación no está aprobada.",
  APPROVED_VERSION_MISSING: "Falta una versión aprobada.",
  LISTING_VERSION_STALE: "La versión aprobada ya no es la vigente.",
  LISTING_CONTENT_INCOMPLETE: "Faltan datos, condición o especificaciones.",
  REQUIRED_IMAGES_MISSING: "Faltan fotos aprobadas requeridas.",
  UNSAFE_PUBLIC_CONTENT:
    "El contenido público requiere revisión de privacidad.",
  PRICING_MISSING: "Falta un precio aprobado.",
  PRICING_EXPIRED: "El precio aprobado expiró.",
  PRICING_VERSION_STALE: "El precio no corresponde a la versión vigente.",
  PRICING_NOT_VIABLE: "La viabilidad de precio no permite publicar.",
  INVENTORY_ZERO: "No hay inventario disponible.",
  PARTNER_CRITICAL_HOLD: "El Partner tiene una restricción crítica.",
};

export function mapPublicationBlockers(blockers: string[]) {
  return blockers.map(
    (blocker) => publicationBlockerCopy[blocker] ?? "Requiere revisión.",
  );
}

export type PartnerPublicationStatus =
  | "Borrador"
  | "En revisión por Best Round"
  | "Aprobado"
  | "Listo para publicar"
  | "Publicado"
  | "Requiere actualización"
  | "Agotado"
  | "No aprobado"
  | "Requiere ajustes";

export function getPartnerPublicationStatus(input: {
  listingStatus: string;
  publicationReady: boolean;
  published: boolean;
  blockers: string[];
}): PartnerPublicationStatus {
  if (input.published) return "Publicado";
  if (input.blockers.includes("INVENTORY_ZERO")) return "Agotado";
  if (input.publicationReady) return "Listo para publicar";
  if (input.listingStatus === "APPROVED") {
    return input.blockers.some((blocker) =>
      [
        "PRICING_EXPIRED",
        "PRICING_VERSION_STALE",
        "LISTING_VERSION_STALE",
        "UNSAFE_PUBLIC_CONTENT",
      ].includes(blocker),
    )
      ? "Requiere actualización"
      : "Aprobado";
  }
  if (["SUBMITTED", "UNDER_REVIEW"].includes(input.listingStatus)) {
    return "En revisión por Best Round";
  }
  if (input.listingStatus === "CHANGES_REQUESTED") return "Requiere ajustes";
  if (input.listingStatus === "REJECTED") return "No aprobado";
  return "Borrador";
}

export type MarketplaceCartIssue =
  | "none"
  | "price_changed"
  | "listing_changed"
  | "unavailable"
  | "marketplace_disabled";

export function getMarketplaceCartIssue(input: {
  listingVersionChanged: boolean;
  priceChanged: boolean;
  available: boolean;
  blockers: string[];
}): MarketplaceCartIssue {
  if (input.blockers.includes("MARKETPLACE_DISABLED")) {
    return "marketplace_disabled";
  }
  if (input.listingVersionChanged) return "listing_changed";
  if (input.priceChanged) return "price_changed";
  if (!input.available || input.blockers.length > 0) return "unavailable";
  return "none";
}

export function marketplaceCartIssueMessage(issue: MarketplaceCartIssue) {
  switch (issue) {
    case "marketplace_disabled":
      return "Marketplace no está disponible. Este artículo no puede comprarse ahora.";
    case "listing_changed":
      return "Este artículo fue actualizado. Revísalo antes de continuar.";
    case "price_changed":
      return "El precio de este artículo cambió.";
    case "unavailable":
      return "Este artículo ya no está disponible.";
    default:
      return null;
  }
}

export function getActivationEnvironmentBlockers(input: {
  appEnvironment: string;
  supabaseUrl?: string;
  marketplaceDeploymentEnabled: boolean;
  paymentsMode: string;
  stripeMode: string;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  serviceRoleKey?: string;
}) {
  const blockers: string[] = [];
  if (
    !isSafeMarketplaceActivationEnvironment(
      input.appEnvironment,
      input.supabaseUrl,
    )
  )
    blockers.push("NOT_STAGING");
  if (!input.marketplaceDeploymentEnabled) blockers.push("DEPLOYMENT_GATE_OFF");
  if (input.paymentsMode !== "test") blockers.push("PAYMENTS_NOT_TEST");
  if (input.stripeMode !== "test") blockers.push("STRIPE_NOT_TEST");
  if (!input.stripeSecretKey?.startsWith("sk_test_"))
    blockers.push("STRIPE_KEY_NOT_TEST");
  if (!input.stripeWebhookSecret?.startsWith("whsec_"))
    blockers.push("STRIPE_WEBHOOK_MISSING");
  if (!input.serviceRoleKey) blockers.push("SERVICE_ROLE_MISSING");
  return blockers;
}

export function isSafeMarketplaceActivationEnvironment(
  appEnvironment: string,
  supabaseUrl: string | undefined,
) {
  if (appEnvironment === "staging") return true;
  if (!["development", "test"].includes(appEnvironment)) return false;
  try {
    if (!supabaseUrl) return false;
    const hostname = new URL(supabaseUrl).hostname;
    return ["localhost", "127.0.0.1", "::1"].includes(hostname);
  } catch {
    return false;
  }
}
