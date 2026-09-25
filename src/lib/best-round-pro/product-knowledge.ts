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

export type CategoryInterpretation = {
  reason: string;
  caveat: string | null;
  factsUsed: string[];
  interpretations: string[];
};

export function interpretCategoryRecommendation(input: {
  family: string;
  product: ProductKnowledgeDTO | null;
  answers: Record<string, string | number | boolean | number[] | null | undefined>;
  targetPlayerLevel?: string | null;
}) : CategoryInterpretation {
  const product = input.product;
  const specs = product?.specs ?? {};
  const factsUsed: string[] = [];
  const interpretations: string[] = [];
  let reason = "Con la información disponible, puede tener sentido como candidato.";
  let caveat: string | null = null;
  const loft = specs.loftDegrees;
  const flex = specs.shaftFlex;
  const material = specs.shaftMaterial;
  const currentLofts = Array.isArray(input.answers.currentWedgeLofts) ? input.answers.currentWedgeLofts.filter((value): value is number => typeof value === "number") : [];
  if (input.family === "DRIVER") {
    if (loft != null) factsUsed.push("loftDegrees");
    if (flex != null) factsUsed.push("shaftFlex");
    if (material != null) factsUsed.push("shaftMaterial");
    const config = [loft != null ? `${loft}°` : null, flex ? `shaft ${String(flex)}` : null, material ? `de ${String(material)}` : null].filter(Boolean).join(" ");
    reason = config ? `Lo veo como candidato por su configuración de ${config}: un loft así puede facilitar un lanzamiento más alto y un shaft ${String(flex ?? "").toLowerCase() || "registrado"} suele ser más fácil de cargar que uno más rígido. Eso encaja con tu objetivo de distancia, aunque el flex ideal depende de tu velocidad y tempo.` : reason;
    if (!flex) caveat = "Me falta el flex de la varilla para afinar la recomendación.";
    interpretations.push("relación entre loft, carga de la varilla y objetivo de distancia");
  } else if (input.family === "FAIRWAY_WOOD") {
    if (loft != null) factsUsed.push("loftDegrees");
    reason = loft != null ? `Con ${loft}° puede cubrir un escalón concreto entre tu driver y los palos más cortos, especialmente si buscas una madera para tee o fairway.` : "Puede tener sentido como madera de apoyo, pero necesito su loft para ubicarla en la bolsa.";
    caveat = loft == null ? "Revisaría el loft antes de confirmar qué hueco cubre." : null;
    interpretations.push("papel de la madera según loft y composición conocida");
  } else if (input.family === "HYBRID") {
    if (loft != null) factsUsed.push("loftDegrees");
    reason = loft != null ? `Por sus ${loft}° puede servir como puente entre una madera y un hierro largo, aunque conviene comprobar si se solapa con los lofts que ya llevas.` : "Un híbrido puede cubrir el espacio entre madera e hierro, pero necesito su loft para valorar el hueco real.";
    caveat = loft == null ? "Falta el loft para descartar solapamientos." : null;
    interpretations.push("posible puente o solapamiento entre madera e hierro");
  } else if (input.family === "IRON") {
    if (flex != null) factsUsed.push("shaftFlex");
    if (input.targetPlayerLevel) factsUsed.push("targetPlayerLevel");
    reason = input.targetPlayerLevel === "BEGINNER" && Number(input.answers.handicapIndex) <= 9.9
      ? "Te puede servir, pero por tu Handicap Index no sería mi primera opción: el posicionamiento registrado lo orienta a jugadores que empiezan, y probablemente aprovecharías mejor un set de hierros más específico."
      : `Lo valoraría por su composición y ${flex ? `shaft ${String(flex)}` : "configuración registrada"}; la elección final depende de cómo encaje con tus hierros actuales y tus distancias.`;
    interpretations.push("composición y posicionamiento del set de hierros");
  } else if (input.family === "WEDGE") {
    const candidateLoft = typeof loft === "number" ? loft : Number(product?.name.match(/(\d{2})\s*°/)?.[1] ?? NaN);
    if (Number.isFinite(candidateLoft)) factsUsed.push("loftDegrees");
    if (currentLofts.length) factsUsed.push("currentWedgeLofts");
    if (Number.isFinite(candidateLoft) && currentLofts.length) {
      const same = currentLofts.includes(candidateLoft);
      const higher = currentLofts.filter((value) => value > candidateLoft).sort((a, b) => a - b)[0];
      reason = same ? `Veo posible redundancia: ya llevas un wedge de ${candidateLoft}°, así que antes de añadir otro revisaría qué hueco quieres cubrir.` : higher ? `Tu wedge de ${higher}° cubre golpes de más loft; este ${candidateLoft}° normalmente ocuparía un papel de menor loft y algo más de distancia, por lo que puede cerrar un hueco hacia tus hierros.` : `Este ${candidateLoft}° puede completar la progresión de lofts que ya llevas, aunque conviene revisar el espacio entre tus wedges.`;
      caveat = currentLofts.length < 2 ? "Me falta conocer los demás lofts para confirmar que no haya otro solapamiento." : null;
    } else {
      reason = Number.isFinite(candidateLoft) ? `Este wedge de ${candidateLoft}° puede tener sentido, pero su papel depende de los lofts que ya llevas y del tipo de golpe que quieres cubrir.` : reason;
      caveat = "Me faltan tus lofts actuales para afinar el gapping.";
    }
    interpretations.push("relación de loft y gapping del juego corto");
  } else if (input.family === "PUTTER") {
    const candidateLength = specs.putterLengthInches;
    const currentLength = input.answers.currentPutterLength;
    if (candidateLength != null) factsUsed.push("putterLengthInches");
    if (currentLength != null) factsUsed.push("currentPutterLength");
    reason = candidateLength != null && currentLength != null ? `Mide ${candidateLength}" frente a las ${currentLength}" que usas ahora; ese cambio puede alterar la postura y la sensación de control, así que lo probaría en tu posición habitual.` : "Puede ser una opción, pero en un putter la longitud y tu postura son determinantes para confirmar el encaje.";
    caveat = candidateLength == null || currentLength == null ? "Necesitaría comparar la longitud con tu postura y configuración actual." : null;
    interpretations.push("relación entre longitud, postura y configuración actual");
  } else if (input.family === "SET") {
    if (input.targetPlayerLevel) factsUsed.push("targetPlayerLevel");
    if (input.answers.handicapIndex != null) factsUsed.push("handicapIndex");
    reason = input.targetPlayerLevel === "BEGINNER" && Number(input.answers.handicapIndex) <= 9.9
      ? "Te puede servir técnicamente, pero no sería mi primera recomendación para un Handicap Index 8: está posicionado para quien empieza o busca un paquete completo sencillo."
      : "Lo valoraría por la composición registrada y por cómo cubre las categorías que necesitas en una sola bolsa.";
    interpretations.push("composición del set y posicionamiento de jugador");
  }
  return { reason, caveat, factsUsed, interpretations };
}

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
        putterLengthInches: (product.clubSpecs as Record<string, unknown> | null | undefined)?.length_inches as number | null ?? null,
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
