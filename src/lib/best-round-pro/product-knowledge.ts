import "server-only";

import type { PublicProduct } from "@/lib/catalog/public-products";

export type KnowledgeIntent =
  | "PRODUCT_PRICE"
  | "PRODUCT_AVAILABILITY"
  | "PRODUCT_CONDITION"
  | "PRODUCT_SPEC"
  | "PRODUCT_CONTENTS"
  | "PRODUCT_SOURCE"
  | "PURCHASE_READINESS"
  | "STORE_SHIPPING"
  | "STORE_RETURNS"
  | "STORE_CLAIMS"
  | "STORE_TRADE_IN"
  | "PRODUCT_COMPARISON"
  | null;

export type ProductReadinessStatus = "READY" | "PARTIAL" | "INSUFFICIENT";

export type StorePolicy = {
  topic: "SHIPPING" | "RETURNS" | "CLAIMS" | "TRADE_IN";
  source: "FIRST_PARTY" | "MARKETPLACE" | "GENERAL";
  resolution: "KNOWN" | "PARTIAL" | "NOT_IMPLEMENTED";
  buyerPaysShipping?: boolean;
  freeShipping?: boolean;
  partnerStockConfirmationHours?: number;
  partnerHandoffHours?: number;
  remorseReturnAllowed?: boolean;
  validClaimReasons: string[];
};

export type ProductKnowledgeDTO = {
  id: string;
  slug: string;
  name: string;
  canonicalProductFamily: string | null;
  price: number | null;
  currency: string | null;
  formattedPrice: string | null;
  availability: "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";
  sellable: boolean | null;
  condition: string | null;
  handedness: string | null;
  brand: string | null;
  model: string | null;
  specs: Record<string, string | number | boolean | null>;
  includedItems: string[] | null;
  headcoverStatus: "INCLUDED" | "NOT_INCLUDED" | "UNKNOWN";
  sourceType: "FIRST_PARTY" | "MARKETPLACE";
  sellerIdentityExposed: false;
  readiness: ProductReadinessStatus;
  missingRequiredFields: string[];
  missingRecommendedFields: string[];
};

export function classifyKnowledgeIntent(text: string): KnowledgeIntent {
  const value = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/cu[aá]nto cuesta|qu[eé] precio|en cu[aá]nto est[aá]|precio/.test(value)) return "PRODUCT_PRICE";
  if (/est[aá] disponible|hay stock|tiene stock/.test(value)) return "PRODUCT_AVAILABILITY";
  if (/puedo comprarlo hoy|comprar hoy/.test(value)) return "PURCHASE_READINESS";
  if (/es nuevo|es usada?|es usado|condici[oó]n/.test(value)) return "PRODUCT_CONDITION";
  if (/qu[eé] incluye|incluye este|composici[oó]n|headcover|funda/.test(value)) return "PRODUCT_CONTENTS";
  if (/qui[eé]n lo vende|lo vende best round|marketplace|best round/.test(value)) return "PRODUCT_SOURCE";
  if (/hacen env[ií]os|env[ií]an|env[ií]o|entrega/.test(value)) return "STORE_SHIPPING";
  if (/devoluci[oó]n|devolver|cambio de opini[oó]n/.test(value)) return "STORE_RETURNS";
  if (/llega roto|da[nñ]ado|reclamo|reclamaci[oó]n|diferente a lo publicado|especificaci[oó]n.*incorrecta|no funciona/.test(value)) return "STORE_CLAIMS";
  if (/trade.?in|toman mi palo|aceptan.*equipo/.test(value)) return "STORE_TRADE_IN";
  if (/qu[eé] flex|flex|loft|lie|shaft|varilla|bounce|grip|peso.*varilla|headcover/.test(value)) return "PRODUCT_SPEC";
  if (/compar|con qu[eé]|diferencia|parecido/.test(value)) return "PRODUCT_COMPARISON";
  return null;
}

function normalizeCondition(value: string | null | undefined) {
  if (!value) return null;
  return value === "new" ? "NEW" : value.toUpperCase();
}

export function productReadiness(input: {
  family: string | null;
  brand: string | null;
  model: string | null;
  price: number | null;
  condition: string | null;
  availability: ProductKnowledgeDTO["availability"];
  handedness?: string | null;
  specs?: Record<string, unknown>;
}): Pick<ProductKnowledgeDTO, "readiness" | "missingRequiredFields" | "missingRecommendedFields"> {
  const required = [
    ["canonicalFamily", Boolean(input.family)],
    ["brandModel", Boolean(input.brand && input.model)],
    ["price", input.price !== null],
    ["condition", Boolean(input.condition)],
    ["availability", input.availability !== "UNKNOWN"],
  ] as const;
  const missingRequiredFields = required.filter(([, present]) => !present).map(([key]) => key);
  const missingRecommendedFields = input.family === "DRIVER" || input.family === "WEDGE" || input.family === "PUTTER"
    ? Object.entries(input.specs ?? {}).filter(([, value]) => value === null || value === undefined).map(([key]) => key)
    : [];
  return {
    readiness: missingRequiredFields.length ? "INSUFFICIENT" : missingRecommendedFields.length ? "PARTIAL" : "READY",
    missingRequiredFields,
    missingRecommendedFields,
  };
}

export function toProductKnowledge(product: PublicProduct): ProductKnowledgeDTO {
  const family = product.productFamily === "set" ? "SET" : product.clubType?.toUpperCase() ?? product.productFamily?.toUpperCase() ?? null;
  const availability = product.fulfillmentType === "in_stock"
    ? "AVAILABLE"
    : product.fulfillmentType
      ? "UNAVAILABLE"
      : "UNKNOWN";
  const specs: ProductKnowledgeDTO["specs"] = family === "SET"
    ? {
        handedness: product.handedness,
        shaftFlex: product.shaftFlex,
        shaftMaterial: product.shaftMaterial,
      }
    : {
        loftDegrees: product.loftDegrees,
        handedness: product.handedness,
        shaftFlex: product.shaftFlex,
        shaftMaterial: product.shaftMaterial,
        shaftWeightGrams: product.clubSpecs?.shaft_weight_grams ?? null,
        lieDegrees: product.clubSpecs?.lie_degrees ?? null,
        bounceDegrees: product.clubSpecs?.bounce_degrees ?? null,
        adjustableHosel: product.clubSpecs?.adjustable_hosel ?? null,
      };
  const includedItems = product.components.length
    ? product.components.map((item) => item.club_type ?? item.bag_type).filter((item): item is NonNullable<typeof item> => Boolean(item))
    : null;
  const headcoverStatus: ProductKnowledgeDTO["headcoverStatus"] = product.accessoriesIncluded.some((item) => /headcover|funda/i.test(item))
    ? "INCLUDED"
    : product.accessoriesIncluded.length
      ? "NOT_INCLUDED"
      : "UNKNOWN";
  const readiness = productReadiness({
    family,
    brand: product.brandName,
    model: product.name,
    price: product.price,
    condition: product.condition,
    availability,
    handedness: product.handedness,
    specs,
  });
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    canonicalProductFamily: family,
    price: product.price,
    currency: product.currency,
    formattedPrice: product.price === null ? null : formatMoney({ amountCents: product.price, currency: product.currency }),
    availability,
    sellable: availability === "AVAILABLE",
    condition: normalizeCondition(product.condition),
    handedness: product.handedness,
    brand: product.brandName,
    model: product.name,
    specs,
    includedItems,
    headcoverStatus,
    sourceType: product.source === "FIRST_PARTY" ? "FIRST_PARTY" : "MARKETPLACE",
    sellerIdentityExposed: false,
    ...readiness,
  };
}

export function answerStoreKnowledge(intent: KnowledgeIntent) {
  switch (intent) {
    case "STORE_SHIPPING": return "Sí, hacemos envíos. El costo corre por cuenta del comprador y se determina según el pedido y destino.";
    case "STORE_RETURNS": return "Si sólo cambias de opinión, no hay devolución por arrepentimiento. Sí puedes reportar un problema si llega diferente a lo publicado, dañado, con especificaciones incorrectas, es falsificado o no funciona.";
    case "STORE_CLAIMS": return "Si llega diferente a lo publicado, dañado, con especificaciones incorrectas, falsificado o no funciona, repórtalo por soporte para abrir un reclamo. Conserva el embalaje y la evidencia del pedido.";
    case "STORE_TRADE_IN": return "Trade-In es informativo en esta etapa: no puedo aceptar equipo ni calcular una cotización desde el chat. No se crea ninguna operación automáticamente.";
    default: return null;
  }
}

export function answerProductKnowledge(intent: KnowledgeIntent, product: ProductKnowledgeDTO, question = "") {
  switch (intent) {
    case "PRODUCT_PRICE": return product.formattedPrice === null ? "No tengo registrado el precio público actual de este producto." : `El precio público actual de ${product.name} es ${product.formattedPrice}.`;
    case "PRODUCT_AVAILABILITY": return product.availability === "AVAILABLE" ? `${product.name} está disponible para compra.` : product.availability === "UNAVAILABLE" ? `${product.name} no está disponible ahora mismo.` : "No tengo confirmada la disponibilidad actual de este producto.";
    case "PURCHASE_READINESS": return product.sellable === true ? `${product.name} está disponible para compra. Esto no garantiza una entrega el mismo día.` : "No puedo confirmar que este producto esté listo para compra ahora mismo.";
    case "PRODUCT_CONDITION": return product.condition ? `${product.name} figura como ${product.condition === "NEW" ? "nuevo" : product.condition === "USED" ? "usado" : product.condition.toLowerCase()}.` : "No tengo registrada la condición de este producto.";
    case "PRODUCT_SOURCE": return product.sourceType === "MARKETPLACE" ? "Este producto lo vende un Partner de Best Round." : "Sí, este producto lo vende directamente Best Round.";
    case "PRODUCT_CONTENTS": return product.includedItems?.length ? `Este producto incluye: ${product.includedItems.map(humanizeCatalogLabel).join(", ")}.` : "No tengo registrada una composición completa para este producto.";
    case "PRODUCT_SPEC": {
      const normalizedQuestion = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      if (/peso.*varilla|pesa.*varilla|shaft.*weight|pesa.*shaft/.test(normalizedQuestion) && product.specs.shaftWeightGrams == null) return "No tengo registrado el peso de la varilla de este producto.";
      if (/flex/.test(normalizedQuestion) && product.specs.shaftFlex == null) return "No tengo registrado el flex de la varilla de este producto.";
      if (/loft/.test(normalizedQuestion) && product.specs.loftDegrees == null) return "No tengo registrado el loft de este producto.";
      const available = Object.entries(product.specs).filter(([, value]) => value !== null && value !== undefined);
      const labels: Record<string, string> = {
        loftDegrees: "loft",
        handedness: "mano",
        shaftFlex: "flex de la varilla",
        shaftMaterial: "material de la varilla",
        shaftWeightGrams: "peso de la varilla",
        lieDegrees: "lie",
        bounceDegrees: "bounce",
        grind: "grind",
        modelYear: "año del modelo",
      };
      const requestedFlex = /flex/.test(normalizedQuestion) && product.specs.shaftFlex != null;
      if (requestedFlex) {
        const flex = String(product.specs.shaftFlex).toLowerCase();
        return `La varilla es ${flex.charAt(0).toUpperCase() + flex.slice(1)}${product.specs.shaftMaterial ? ` y de ${product.specs.shaftMaterial}` : ""}. ${flex === "regular" ? "Suele ser una opción más fácil de cargar que un Stiff; confirmaría la velocidad de swing antes de llamarlo el flex ideal." : "Para saber si es tu flex ideal, conviene contrastarlo con tu velocidad de swing."}`;
      }
      return available.length
        ? `Tengo registradas estas especificaciones: ${available.map(([key, value]) => `${labels[key] ?? key}: ${value}`).join(", ")}.`
        : "Esa especificación no está registrada para este producto.";
    }
    default: return null;
  }
}

export function formatMoney(input: { amountCents: number; currency: string }) {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents < 0) return "Precio no disponible";
  const cents = BigInt(input.amountCents);
  const hundred = BigInt(100);
  const whole = cents / hundred;
  const fraction = String(cents % hundred).padStart(2, "0");
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return input.currency.toUpperCase() === "MXN" ? `$${grouped}.${fraction} MXN` : `${input.currency.toUpperCase()} ${grouped}.${fraction}`;
}

export function humanizeCatalogLabel(value: string) {
  const normalized = value.replaceAll("_", " ").toLowerCase();
  return ({
    driver: "Driver",
    "fairway wood": "madera de fairway",
    hybrid: "híbrido",
    iron: "hierros",
    wedge: "wedge",
    putter: "putter",
    set: "set completo",
    bag: "bolsa",
  } as Record<string, string>)[normalized] ?? value;
}
