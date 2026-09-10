export const COMMERCIAL_INTENTS = [
  "CATALOG_SEARCH",
  "PRODUCT_SEARCH",
  "PRODUCT_QUESTION",
  "PRODUCT_COMPARISON",
  "PRODUCT_ADVICE",
  "FITTING_RECOMMENDATION",
  "STORE_FAQ",
  "STORE_POLICY",
  "SALES_OBJECTION",
  "GENERAL_GOLF",
  "TRADE_IN",
  "ORDER_HELP",
  "OTHER",
] as const;

export type ConversationIntent = (typeof COMMERCIAL_INTENTS)[number];

export function routeConversationIntent(text: string): ConversationIntent {
  const value = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX")
    .trim();
  if (/margen|comision|comercial interna|match\s*100|ignora.*regla/.test(value))
    return "SALES_OBJECTION";
  if (/envio|entrega|devol|garantia|pago|pedido|orden/.test(value))
    return /pedido|orden/.test(value) ? "ORDER_HELP" : "STORE_POLICY";
  if (/trade\s*-?in|recib.*seminuev|vender mi equipo/.test(value))
    return "TRADE_IN";
  if (/compar|vs\.?|diferencia|parecido.*barato|mas barato/.test(value))
    return "PRODUCT_COMPARISON";
  if (/set|juego completo|kit|paquete/.test(value) && /recomiend|empezar|principiante/.test(value) && !/handicap|swing|mi juego|compatib/.test(value))
    return "PRODUCT_SEARCH";
  if (/es bueno para mi|me sirve|me conviene|recomiend|para mi juego|segun mi|para handicap|para mi\b/.test(value))
    return "FITTING_RECOMMENDATION";
  if (/\b(tienen|hay|manejan|que tienen|que opciones|muestran|disponib)/.test(value))
    return "CATALOG_SEARCH";
  if (/\b(quiero|busco|necesito|mu[eé]strame|dame)\b/.test(value))
    return /set|juego completo|kit|paquete|driver|wedge|putter|hierro|hibrido|hybrid|bolsa|accesorio|pelota/.test(value)
      ? "PRODUCT_SEARCH"
      : "OTHER";
  if (/\b(set|juego completo|kit|paquete|driver|wedge|putter|hierro|hibrido|hybrid|bolsa|accesorio|pelota)/.test(value))
    return "PRODUCT_SEARCH";
  if (/como|que significa|faq|ayuda|catalogo|tienda/.test(value)) return "STORE_FAQ";
  return "OTHER";
}

export function isFittingIntent(intent: ConversationIntent) {
  return intent === "FITTING_RECOMMENDATION" || intent === "PRODUCT_ADVICE";
}

export function isCatalogIntent(intent: ConversationIntent) {
  return intent === "CATALOG_SEARCH" || intent === "PRODUCT_SEARCH" || intent === "PRODUCT_COMPARISON";
}
