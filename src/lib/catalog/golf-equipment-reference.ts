export type GolfEquipmentCategory = {
  id: string;
  slug: string;
  label: string;
  family: string;
  kind: string | null;
};

export type GolfBrandSuggestion = { id: string; name: string; slug: string };
export type GolfModelSuggestion = {
  id: string;
  brandId: string;
  categoryId: string;
  name: string;
  normalizedName: string;
};

export function normalizeGolfReference(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function findGolfBrandSuggestions(
  brands: GolfBrandSuggestion[],
  query: string,
): GolfBrandSuggestion[] {
  const needle = normalizeGolfReference(query);
  if (!needle) return brands;
  return [...brands]
    .sort((a, b) => {
      const rank = (item: GolfBrandSuggestion) => {
        const key = normalizeGolfReference(item.name);
        return key === needle
          ? 0
          : key.startsWith(needle)
            ? 1
            : key.includes(needle)
              ? 2
              : 3;
      };
      return rank(a) - rank(b) || a.name.localeCompare(b.name);
    })
    .filter((item) => {
      const key = normalizeGolfReference(item.name);
      return key === needle || key.startsWith(needle) || key.includes(needle);
    });
}

export function findGolfModelSuggestions(
  models: GolfModelSuggestion[],
  query: string,
  brandId?: string,
  categoryId?: string,
): GolfModelSuggestion[] {
  const needle = normalizeGolfReference(query);
  return [...models]
    .filter(
      (item) =>
        (!brandId || item.brandId === brandId) &&
        (!categoryId || item.categoryId === categoryId),
    )
    .sort((a, b) => {
      const rank = (item: GolfModelSuggestion) => {
        const key = normalizeGolfReference(item.name);
        return !needle
          ? 0
          : key === needle
            ? 0
            : key.startsWith(needle)
              ? 1
              : key.includes(needle)
                ? 2
                : 3;
      };
      return rank(a) - rank(b) || a.name.localeCompare(b.name);
    })
    .filter(
      (item) =>
        !needle ||
        [item.name, item.normalizedName].some((value) =>
          normalizeGolfReference(value).includes(needle),
        ),
    );
}

export function displayGolfCategory(
  family: string,
  kind: string | null,
  fallback: string,
): string {
  const labels: Record<string, string> = {
    driver: "Driver",
    fairway_wood: "Madera",
    hybrid: "Híbrido",
    iron: "Hierros",
    wedge: "Wedge",
    putter: "Putter",
    complete_set: "Set completo",
    iron_set: "Set de hierros",
    cart_bag: "Bolsa de carrito",
    stand_bag: "Bolsa de soporte",
    tour_bag: "Bolsa Tour",
    pencil_bag: "Bolsa Pencil",
    travel_bag: "Bolsa de viaje",
  };
  return (
    labels[kind ?? ""] ?? (family === "club" ? "Equipo de golf" : fallback)
  );
}
