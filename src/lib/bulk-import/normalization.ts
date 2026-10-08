import type { CatalogModelReference, FieldNormalization, NormalizedBulkRow, RawCsvRow } from "./types";

const clean = (value: string) => value.normalize("NFKC").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[‐‑‒–—]/g, "-").replace(/\s+/g, " ").trim();
const key = (value: string) => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-MX");
const compact = (value: string) => key(value).replace(/[\s._-]+/g, "");

export const curatedBrandAliases: Record<string, string> = {
  titleist: "Titleist", "titleist golf": "Titleist", "taylor made": "TaylorMade", taylormade: "TaylorMade", "adams golf": "Adams Golf", callaway: "Callaway", ping: "PING", "cleveland golf": "Cleveland Golf", cobra: "Cobra", honma: "Honma", mizuno: "Mizuno", odyssey: "Odyssey", pxg: "PXG", srixon: "Srixon", "sub 70": "Sub 70", "tour edge": "Tour Edge", "wilson staff": "Wilson Staff", "ben hogan golf": "Ben Hogan Golf", "bridgestone golf": "Bridgestone Golf", "scotty cameron": "Scotty Cameron",
};

export const categoryAliases: Record<string, { name: string; slug: string }> = {
  driver: { name: "Driver", slug: "driver" }, drivers: { name: "Driver", slug: "driver" }, "madera 1": { name: "Driver", slug: "driver" },
  fairway: { name: "Madera", slug: "fairway-wood" }, "fairway wood": { name: "Madera", slug: "fairway-wood" }, "madera de calle": { name: "Madera", slug: "fairway-wood" },
  hibrido: { name: "Híbrido", slug: "hybrid" }, hybrid: { name: "Híbrido", slug: "hybrid" }, rescue: { name: "Híbrido", slug: "hybrid" },
  hierro: { name: "Hierros", slug: "iron" }, hierros: { name: "Hierros", slug: "iron" }, iron: { name: "Hierros", slug: "iron" }, irons: { name: "Hierros", slug: "iron" },
  wedge: { name: "Wedges", slug: "wedge" }, wedges: { name: "Wedges", slug: "wedge" }, putter: { name: "Putter", slug: "putter" }, putt: { name: "Putter", slug: "putter" },
};

const aliases: Record<string, string[]> = {
  externalId: ["id externo", "idexterno", "sku"], category: ["categoria", "tipo de baston", "categoria de producto"], brand: ["marca"], model: ["modelo"], modelYear: ["ano", "año"], condition: ["estado", "condicion", "condición"], quantity: ["cantidad", "qty"], hand: ["mano", "hand"], loft: ["loft"], bounce: ["bounce"], grind: ["grind"], flex: ["flex"], shaftMaterial: ["material varilla"], headcover: ["headcover", "cubierta"], acquisitionCost: ["costo adquisicion", "costo adquisición"], askingPrice: ["precio solicitado", "precio propuesto"], desiredNet: ["neto deseado"], photoKey: ["clave fotos", "clave de fotos"], notes: ["notas", "nota"],
};

export function getColumn(values: Record<string, string>, field: keyof typeof aliases): string {
  const wanted = aliases[field].map(key);
  const entry = Object.entries(values).find(([name]) => wanted.includes(key(name)));
  return entry?.[1] ?? "";
}

function field(original: string, value: FieldNormalization["value"], kind: FieldNormalization["kind"], code?: string): FieldNormalization {
  return { original, value, kind, ...(code ? { code } : {}) };
}

export function normalizeBrand(raw: string): FieldNormalization {
  const original = raw; const value = curatedBrandAliases[key(raw)];
  return value ? field(original, value, key(raw) === key(value) ? "EXACT" : "AUTO_NORMALIZED") : field(original, clean(raw) || null, "NORMALIZED_WITH_WARNING", "MANUAL_BRAND");
}

export function normalizeCategory(raw: string): FieldNormalization {
  const original = raw; const normalized = categoryAliases[key(raw)];
  if (normalized) return field(original, normalized.slug, key(raw) === normalized.slug ? "EXACT" : "AUTO_NORMALIZED");
  if (key(raw) === "madera") return field(original, null, "AMBIGUOUS", "AMBIGUOUS_CATEGORY");
  return field(original, clean(raw) || null, "INVALID", "UNKNOWN_CATEGORY");
}

export function normalizeHand(raw: string): FieldNormalization {
  const original = raw; const normalized = key(raw);
  if (["derecho", "derecha", "diestro", "diestra", "rh", "right"].includes(normalized)) return field(original, "RIGHT", "AUTO_NORMALIZED");
  if (["izquierdo", "izquierda", "zurdo", "zurda", "lh", "left"].includes(normalized)) return field(original, "LEFT", "AUTO_NORMALIZED");
  return field(original, null, raw ? "INVALID" : "EXACT", raw ? "INVALID_HAND" : undefined);
}

export function normalizeCondition(raw: string): FieldNormalization {
  const original = raw; const normalized = key(raw);
  if (["nuevo", "new"].includes(normalized)) return field(original, "new", normalized === "new" ? "EXACT" : "AUTO_NORMALIZED");
  if (["usado", "usada", "seminuevo", "seminueva", "used", "pre-owned", "preowned"].includes(normalized)) return field(original, "used", "AUTO_NORMALIZED");
  return field(original, raw ? null : null, raw ? "INVALID" : "EXACT", raw ? "UNKNOWN_CONDITION" : undefined);
}

export function normalizeFlex(raw: string): FieldNormalization {
  const original = raw; const normalized = key(raw);
  const map: Record<string, string> = { r: "REGULAR", reg: "REGULAR", regular: "REGULAR", s: "STIFF", stiff: "STIFF", x: "X_STIFF", "x-stiff": "X_STIFF", "extra stiff": "X_STIFF", a: "SENIOR", senior: "SENIOR", ladies: "LADIES", lady: "LADIES" };
  return map[normalized] ? field(original, map[normalized], "AUTO_NORMALIZED") : field(original, raw ? null : null, raw ? "NORMALIZED_WITH_WARNING" : "EXACT", raw ? "UNKNOWN_FLEX" : undefined);
}

export function normalizeShaftMaterial(raw: string): FieldNormalization {
  const original = raw; const normalized = key(raw);
  if (["grafito", "graphite", "carbon"].includes(normalized)) return field(original, "GRAPHITE", "AUTO_NORMALIZED");
  if (["acero", "steel"].includes(normalized)) return field(original, "STEEL", "AUTO_NORMALIZED");
  return field(original, raw ? "OTHER" : null, raw ? "NORMALIZED_WITH_WARNING" : "EXACT", raw ? "UNKNOWN_SHAFT_MATERIAL" : undefined);
}

export function normalizeBoolean(raw: string): FieldNormalization {
  const original = raw; const normalized = key(raw);
  if (["si", "yes", "y", "1", "true"].includes(normalized)) return field(original, true, "AUTO_NORMALIZED");
  if (["no", "n", "0", "false"].includes(normalized)) return field(original, false, "AUTO_NORMALIZED");
  return field(original, raw ? null : null, raw ? "NORMALIZED_WITH_WARNING" : "EXACT", raw ? "UNKNOWN_BOOLEAN" : undefined);
}

export function normalizeNumber(raw: string, options: { integer?: boolean; max?: number } = {}): FieldNormalization {
  const original = raw; const normalized = clean(raw).replace(/[°º]/g, "");
  if (!normalized) return field(original, null, "EXACT");
  const value = Number(normalized.replace(",", "."));
  if (!Number.isFinite(value) || (options.integer && !Number.isInteger(value)) || (options.max !== undefined && value > options.max) || value < 0) return field(original, null, "INVALID", "INVALID_NUMBER");
  return field(original, value, normalized === String(value) ? "EXACT" : "AUTO_NORMALIZED");
}

export function normalizeYear(raw: string): FieldNormalization {
  const parsed = normalizeNumber(raw, { integer: true, max: 2200 });
  if (parsed.value === null) return parsed;
  let value = parsed.value as number;
  if (value >= 0 && value < 100) value += value >= 40 ? 1900 : 2000;
  if (value < 1900 || value > 2200) return field(raw, null, "INVALID", "INVALID_MODEL_YEAR");
  return { ...parsed, value };
}

export function parseMoneyToMinorUnits(raw: string): FieldNormalization {
  const original = raw; let value = clean(raw).replace(/^\$\s*/, "").replace(/\s*(MXN|USD)\s*$/i, "").trim();
  if (!value) return field(original, null, "EXACT");
  const hasCurrency = /^\$/.test(clean(raw)) || /MXN|USD/i.test(raw);
  if (/[.][0-9]{3}$/.test(value) && !/[.][0-9]{1,2}$/.test(value)) return field(original, null, "AMBIGUOUS", "AMBIGUOUS_MONEY_FORMAT");
  if (/,\d{3}$/.test(value) && !hasCurrency) return field(original, null, "AMBIGUOUS", "AMBIGUOUS_MONEY_FORMAT");
  if (hasCurrency && /^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(value)) value = value.replaceAll(",", "");
  else if (/^\d+(,\d{1,2})$/.test(value)) value = value.replace(",", ".");
  const number = Number(value.replaceAll(",", ""));
  if (!Number.isFinite(number) || number < 0 || number > 99_999_999_999) return field(original, null, "INVALID", "INVALID_MONEY");
  return field(original, Math.round(number * 100), "AUTO_NORMALIZED");
}

export function normalizePhotoKey(raw: string): string | null {
  const value = key(raw).replace(/[ _]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return value || null;
}

export function normalizeModelName(raw: string): string {
  let result = clean(raw).replace(/\s+/g, " ");
  result = result.replace(/\bGT\s+([0-9])/gi, "GT$1").replace(/\bStealth\s*2\b/gi, "Stealth 2");
  return result;
}

export function normalizeBulkRow(row: RawCsvRow): NormalizedBulkRow {
  const original = row.values;
  const brand = normalizeBrand(getColumn(original, "brand"));
  const category = normalizeCategory(getColumn(original, "category"));
  const modelRaw = getColumn(original, "model");
  const model = field(modelRaw, modelRaw ? normalizeModelName(modelRaw) : null, modelRaw && normalizeModelName(modelRaw) !== clean(modelRaw) ? "AUTO_NORMALIZED" : "EXACT");
  const year = normalizeYear(getColumn(original, "modelYear"));
  const condition = normalizeCondition(getColumn(original, "condition"));
  const quantity = normalizeNumber(getColumn(original, "quantity"), { integer: true, max: 10_000 });
  const hand = normalizeHand(getColumn(original, "hand"));
  const loft = normalizeNumber(getColumn(original, "loft"), { max: 80 });
  const bounce = normalizeNumber(getColumn(original, "bounce"), { max: 80 });
  const flex = normalizeFlex(getColumn(original, "flex"));
  const shaftMaterial = normalizeShaftMaterial(getColumn(original, "shaftMaterial"));
  const headcover = normalizeBoolean(getColumn(original, "headcover"));
  const acquisition = parseMoneyToMinorUnits(getColumn(original, "acquisitionCost"));
  const asking = parseMoneyToMinorUnits(getColumn(original, "askingPrice"));
  const desiredNet = parseMoneyToMinorUnits(getColumn(original, "desiredNet"));
  const fields = { externalId: field(getColumn(original, "externalId"), clean(getColumn(original, "externalId")) || null, getColumn(original, "externalId") ? "EXACT" : "INVALID", getColumn(original, "externalId") ? undefined : "MISSING_EXTERNAL_ID"), brand, category, model, modelYear: year, condition, quantity, hand, loft, bounce, flex, shaftMaterial, headcover, acquisitionCost: acquisition, askingPrice: asking, desiredNet, photoKey: field(getColumn(original, "photoKey"), normalizePhotoKey(getColumn(original, "photoKey")), "AUTO_NORMALIZED"), notes: field(getColumn(original, "notes"), getColumn(original, "notes") || null, "EXACT") } satisfies Record<string, FieldNormalization>;
  return {
    rowNumber: row.rowNumber,
    original,
    normalized: {
      externalId: fields.externalId.value as string | null, category: category.value ? String(category.value) : null, categorySlug: category.value ? String(category.value) : null, brand: brand.value ? String(brand.value) : null, brandSlug: brand.value ? key(String(brand.value)).replaceAll(" ", "-") : null, model: model.value ? String(model.value) : null, modelYear: year.value as number | null, condition: condition.value as string | null, quantity: quantity.value as number | null, hand: hand.value as "RIGHT" | "LEFT" | null, loft: loft.value as number | null, bounce: bounce.value as number | null, grind: getColumn(original, "grind") || null, flex: flex.value as string | null, shaftMaterial: shaftMaterial.value as string | null, headcover: headcover.value as boolean | null, acquisitionCostMinor: acquisition.value as number | null, askingPriceMinor: asking.value as number | null, desiredNetMinor: desiredNet.value as number | null, photoKey: normalizePhotoKey(getColumn(original, "photoKey")), notes: getColumn(original, "notes") || null,
    },
    fields,
  };
}

export function resolveModelWithinContext(input: { row: NormalizedBulkRow; models: CatalogModelReference[] }): { modelId: string | null; candidates: CatalogModelReference[]; issue?: { code: string; message: string; details?: Record<string, unknown> } } {
  const { row, models } = input;
  if (!row.normalized.brand || !row.normalized.category || !row.normalized.model) return { modelId: null, candidates: [] };
  const brandKey = key(row.normalized.brand); const categoryKey = key(row.normalized.category);
  const candidates = models.filter((model) => key(model.brandName) === brandKey && (key(model.categorySlug) === categoryKey || key(model.categoryName) === categoryKey));
  const target = compact(row.normalized.model);
  const exact = candidates.filter((model) => compact(model.modelName) === target || compact(model.normalizedModelName) === target);
  if (exact.length === 1) return { modelId: exact[0].id, candidates: exact };
  if (exact.length > 1 && row.normalized.modelYear !== null) {
    const yearMatch = exact.filter((model) => model.modelYear === row.normalized.modelYear);
    if (yearMatch.length === 1) return { modelId: yearMatch[0].id, candidates: yearMatch };
  }
  if (exact.length > 1) return { modelId: null, candidates: exact, issue: { code: "AMBIGUOUS_MODEL_GENERATION", message: `Encontramos varias generaciones de ${row.normalized.model}.`, details: { candidateIds: exact.map((candidate) => candidate.id) } } };
  if (candidates.length === 0) return { modelId: null, candidates: [], issue: { code: "UNKNOWN_MODEL", message: `No encontramos '${row.normalized.model}' en el catálogo.` } };
  const fuzzy = candidates.filter((model) => compact(model.modelName).includes(target) || target.includes(compact(model.modelName)));
  return fuzzy.length === 1 ? { modelId: null, candidates: fuzzy, issue: { code: "MODEL_SUGGESTION", message: `Sugerimos ${fuzzy[0].modelName}; confirma antes de continuar.` } } : { modelId: null, candidates: [], issue: { code: "UNKNOWN_MODEL", message: `No encontramos '${row.normalized.model}' en el catálogo.` } };
}
