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

export type GolfIdentityResolutionStatus =
  "EXACT_MATCH" | "ALIAS_MATCH" | "AMBIGUOUS" | "NOT_FOUND";
export type GolfIdentityResolution<T> = {
  status: GolfIdentityResolutionStatus;
  canonical: T | null;
  originalInput: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reason: string;
};

export function normalizeGolfReference(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "");
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

export function resolveGolfBrand(
  brands: GolfBrandSuggestion[],
  input: string,
): GolfIdentityResolution<GolfBrandSuggestion> {
  const originalInput = input.trim();
  const key = normalizeGolfReference(originalInput);
  const exact = brands.filter(
    (item) =>
      normalizeGolfReference(item.name) === key ||
      normalizeGolfReference(item.slug) === key,
  );
  if (exact.length === 1)
    return {
      status: "EXACT_MATCH",
      canonical: exact[0],
      originalInput,
      confidence: "HIGH",
      reason: "Coincidencia exacta",
    };
  const suggestions = findGolfBrandSuggestions(brands, originalInput);
  if (suggestions.length === 1)
    return {
      status: "ALIAS_MATCH",
      canonical: suggestions[0],
      originalInput,
      confidence: "MEDIUM",
      reason: "Coincidencia por alias o prefijo",
    };
  if (suggestions.length > 1)
    return {
      status: "AMBIGUOUS",
      canonical: null,
      originalInput,
      confidence: "LOW",
      reason: "Hay más de una marca posible",
    };
  return {
    status: "NOT_FOUND",
    canonical: null,
    originalInput,
    confidence: "LOW",
    reason: "Marca no encontrada",
  };
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

export function resolveGolfModel(
  models: GolfModelSuggestion[],
  input: string,
  brandId?: string,
  categoryId?: string,
): GolfIdentityResolution<GolfModelSuggestion> {
  const originalInput = input.trim();
  const candidates = findGolfModelSuggestions(
    models,
    originalInput,
    brandId,
    categoryId,
  );
  const key = normalizeGolfReference(originalInput);
  const exact = candidates.filter(
    (item) =>
      normalizeGolfReference(item.name) === key ||
      normalizeGolfReference(item.normalizedName) === key,
  );
  if (exact.length === 1)
    return {
      status: "EXACT_MATCH",
      canonical: exact[0],
      originalInput,
      confidence: "HIGH",
      reason: "Coincidencia exacta",
    };
  if (candidates.length === 1)
    return {
      status: "ALIAS_MATCH",
      canonical: candidates[0],
      originalInput,
      confidence: "MEDIUM",
      reason: "Coincidencia normalizada",
    };
  if (candidates.length > 1)
    return {
      status: "AMBIGUOUS",
      canonical: null,
      originalInput,
      confidence: "LOW",
      reason: "Hay más de un modelo posible",
    };
  return {
    status: "NOT_FOUND",
    canonical: null,
    originalInput,
    confidence: "LOW",
    reason: "Modelo no encontrado",
  };
}

export function normalizeGolfEquipmentIdentity(input: {
  brand: string;
  model: string;
  brands: GolfBrandSuggestion[];
  models: GolfModelSuggestion[];
  categoryId?: string;
}) {
  const brand = resolveGolfBrand(input.brands, input.brand);
  const model = resolveGolfModel(
    input.models,
    input.model,
    brand.canonical?.id,
    input.categoryId,
  );
  return {
    brand,
    model,
    status:
      brand.status === "AMBIGUOUS" || model.status === "AMBIGUOUS"
        ? "AMBIGUOUS"
        : brand.canonical && model.canonical
          ? "RESOLVED"
          : "USER_ENTERED",
  } as const;
}

export type IdentityBackfillRow = {
  brand: string | null;
  model: string | null;
  categoryId?: string;
};
export function dryRunGolfIdentityBackfill(
  rows: IdentityBackfillRow[],
  brands: GolfBrandSuggestion[],
  models: GolfModelSuggestion[],
) {
  const counts = {
    EXACT_MATCH: 0,
    ALIAS_MATCH: 0,
    AMBIGUOUS: 0,
    NOT_FOUND: 0,
  } as Record<GolfIdentityResolutionStatus, number>;
  const unresolved: Array<{
    brand: string | null;
    model: string | null;
    status: string;
  }> = [];
  for (const row of rows) {
    const result = normalizeGolfEquipmentIdentity({
      brand: row.brand ?? "",
      model: row.model ?? "",
      brands,
      models,
      categoryId: row.categoryId,
    });
    const status =
      result.brand.status === "NOT_FOUND" || result.model.status === "NOT_FOUND"
        ? "NOT_FOUND"
        : result.brand.status === "AMBIGUOUS" ||
            result.model.status === "AMBIGUOUS"
          ? "AMBIGUOUS"
          : result.brand.status;
    counts[status] += 1;
    if (status === "AMBIGUOUS" || status === "NOT_FOUND")
      unresolved.push({ brand: row.brand, model: row.model, status });
  }
  return { counts, unresolved };
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
