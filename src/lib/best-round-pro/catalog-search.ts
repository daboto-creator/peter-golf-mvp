import "server-only";

import { listPublicProducts, type PublicProductSummary } from "@/lib/catalog/public-products";

export type CommercialCatalogResult = {
  products: PublicProductSummary[];
  message: string;
  error: boolean;
};

function setRequest(text: string) {
  return /set|juego completo|kit|paquete|full set|complete set/.test(text.toLocaleLowerCase("es-MX"));
}

function categoryRequest(text: string) {
  const value = text.toLocaleLowerCase("es-MX");
  if (/driver/.test(value)) return { clubType: "driver" as const, label: "drivers" };
  if (/wedge|sand|gap|lob/.test(value)) return { clubType: "wedge" as const, label: "wedges" };
  if (/putter|putt/.test(value)) return { clubType: "putter" as const, label: "putters" };
  if (/bolsa/.test(value)) return { family: "bag" as const, label: "bolsas" };
  return null;
}

export async function searchCommercialCatalog(text: string): Promise<CommercialCatalogResult> {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const filters = setRequest(normalized)
    ? { family: "set" as const, available: true }
    : categoryRequest(normalized) ?? { available: true };
  const result = await listPublicProducts(filters);
  if (result.error) return { products: [], error: true, message: "No pude consultar el catálogo en este momento. Intenta nuevamente en unos segundos." };
  const products = result.data.slice(0, 3);
  if (!products.length) {
    if (setRequest(normalized)) return { products, error: false, message: "Ahora mismo no tengo un set completo disponible. Si quieres, puedo mostrarte alternativas para armar uno con el inventario actual." };
    const category = categoryRequest(normalized);
    return { products, error: false, message: `Ahora mismo no encontré ${category?.label ?? "productos"} disponibles. Si quieres, puedo buscar otra opción.` };
  }
  const category = setRequest(normalized) ? "sets completos" : categoryRequest(normalized)?.label ?? "estas opciones";
  return { products, error: false, message: `Claro. Encontré ${products.length === 1 ? "una opción" : `${products.length} opciones`} de ${category} disponibles. Puedes revisar cada una y, si quieres, después te ayudo a elegir la que más te convenga.` };
}
