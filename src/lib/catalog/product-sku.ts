export const PRODUCT_SKU_PREFIX = "BRPS";

const brandCodes: Record<string, string> = {
  TITLEIST: "TIT",
  TAYLORMADE: "TM",
  CALLAWAY: "CAL",
  PING: "PNG",
  COBRA: "COB",
};

const productTypeCodes = {
  driver: "DRV",
  fairway_wood: "FW",
  hybrid: "HYB",
  iron: "IRN",
  wedge: "WDG",
  putter: "PUT",
} as const;

const bagTypeCodes = {
  stand_bag: "STB",
  cart_bag: "CTB",
  tour_bag: "TRB",
  travel_bag: "TVB",
} as const;

const flexCodes = {
  regular: "R",
  stiff: "S",
  x_stiff: "X",
  senior: "SR",
  ladies: "L",
} as const;

export type ProductSkuInput = {
  brandName: string;
  productFamily: "" | "club" | "bag" | "set";
  clubType: string;
  bagType: string;
  model: string;
  loftDegrees: string;
  ironNumber: string;
  shaftFlex: string;
  condition: "new" | "used";
  acquisitionChannel: "purchase" | "trade_in";
};

export type ProductSkuReservationInput = Omit<ProductSkuInput, "brandName"> & {
  brandId: string;
};

function normalizeSkuText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase().slice(0, 4).padStart(4, "0");
}

export function generateBrandCode(brandName: string): string {
  const normalized = normalizeSkuText(brandName);
  const compact = normalized.replace(/ /g, "");
  if (brandCodes[compact]) return brandCodes[compact];

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return words
      .map((word) => word[0])
      .join("")
      .slice(0, 4);
  }
  if (compact) return compact.slice(0, 3);
  return `B${stableHash(brandName)}`;
}

export function generateModelCode(model: string): string {
  const normalized = normalizeSkuText(model);
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 8);

  return words
    .map((word) => {
      if (/^\d+$/.test(word) || word.length <= 4) return word;
      const consonants = word.replace(/[AEIOU]/g, "");
      return (consonants || word).slice(0, 2);
    })
    .join("")
    .slice(0, 10);
}

export function generateLoftCode(loftDegrees: string): string {
  if (!/^\d+(?:\.\d{1,2})?$/.test(loftDegrees.trim())) return "";
  const tenths = Math.round(Number(loftDegrees) * 10);
  return Number.isSafeInteger(tenths) && tenths >= 0
    ? String(tenths).padStart(3, "0")
    : "";
}

function generateProductTypeSegments(input: ProductSkuInput): string[] {
  if (input.productFamily === "club") {
    const code =
      productTypeCodes[input.clubType as keyof typeof productTypeCodes];
    return code ? [code] : [];
  }
  if (input.productFamily === "set") return ["SET"];
  if (input.productFamily === "bag") {
    const subtype = bagTypeCodes[input.bagType as keyof typeof bagTypeCodes];
    return subtype ? ["BAG", subtype] : ["BAG"];
  }
  return [];
}

export function buildProductSkuBase(input: ProductSkuInput): string | null {
  const brand = generateBrandCode(input.brandName);
  const productTypes = generateProductTypeSegments(input);
  const model = generateModelCode(input.model);
  if (!input.brandName.trim() || productTypes.length === 0 || !model)
    return null;

  const primarySpec =
    input.productFamily === "club" && input.clubType === "iron"
      ? normalizeSkuText(input.ironNumber).replace(/ /g, "").slice(0, 4)
      : input.productFamily === "club"
        ? generateLoftCode(input.loftDegrees)
        : "";
  const flex = flexCodes[input.shaftFlex as keyof typeof flexCodes] ?? "";
  const condition =
    input.acquisitionChannel === "trade_in"
      ? "T"
      : input.condition === "used"
        ? "U"
        : "N";

  return [
    PRODUCT_SKU_PREFIX,
    brand,
    ...productTypes,
    model,
    primarySpec,
    flex,
    condition,
  ]
    .filter(Boolean)
    .join("-");
}
