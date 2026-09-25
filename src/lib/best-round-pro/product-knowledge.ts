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

export type ProductKnowledgeDTO = {
  id: string;
  slug: string;
  name: string;
  canonicalProductFamily: string | null;
  price: number | null;
  currency: string | null;
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
  if (/llega roto|da[nñ]ado|reclamo|reclamaci[oó]n/.test(value)) return "STORE_CLAIMS";
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
    case "STORE_SHIPPING": return "No tengo una política pública de envíos suficientemente definida para darte una promesa de tarifa, carrier o fecha. Puedo confirmar la disponibilidad del producto concreto.";
    case "STORE_RETURNS": return "La política de devoluciones depende del tipo de producto y su origen. No quiero prometer una devolución de cortesía que no esté confirmada; puedo revisar el producto concreto y su política aplicable.";
    case "STORE_CLAIMS": return "Si el pedido llega roto, conserva el embalaje y repórtalo por el canal de soporte para revisar el caso. No tengo aquí una garantía adicional que pueda prometerte.";
    case "STORE_TRADE_IN": return "Trade-In es informativo en esta etapa: no puedo aceptar equipo ni calcular una cotización desde el chat. No se crea ninguna operación automáticamente.";
    default: return null;
  }
}

export function answerProductKnowledge(intent: KnowledgeIntent, product: ProductKnowledgeDTO) {
  switch (intent) {
    case "PRODUCT_PRICE": return product.price === null ? "No tengo registrado el precio público actual de este producto." : `El precio público actual de ${product.name} es ${product.currency ?? ""} ${product.price}.`;
    case "PRODUCT_AVAILABILITY": return product.availability === "AVAILABLE" ? `${product.name} está disponible para compra.` : product.availability === "UNAVAILABLE" ? `${product.name} no está disponible ahora mismo.` : "No tengo confirmada la disponibilidad actual de este producto.";
    case "PURCHASE_READINESS": return product.sellable === true ? `${product.name} está disponible para compra. Esto no garantiza una entrega el mismo día.` : "No puedo confirmar que este producto esté listo para compra ahora mismo.";
    case "PRODUCT_CONDITION": return product.condition ? `${product.name} figura como ${product.condition === "NEW" ? "nuevo" : product.condition === "USED" ? "usado" : product.condition.toLowerCase()}.` : "No tengo registrada la condición de este producto.";
    case "PRODUCT_SOURCE": return product.sourceType === "MARKETPLACE" ? "Este producto forma parte del Marketplace de Best Round. No puedo compartir la identidad del vendedor." : "Este producto pertenece al inventario de Best Round.";
    case "PRODUCT_CONTENTS": return product.includedItems?.length ? `Este producto incluye: ${product.includedItems.join(", ")}.` : "No tengo registrada una composición completa para este producto.";
    case "PRODUCT_SPEC": {
      const available = Object.entries(product.specs).filter(([, value]) => value !== null && value !== undefined);
      return available.length ? `Tengo registradas estas especificaciones: ${available.map(([key, value]) => `${key}: ${value}`).join(", ")}.` : "Esa especificación no está registrada para este producto.";
    }
    default: return null;
  }
}
