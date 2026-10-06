/**
 * Local, source-controlled brand marks for Mi Golf cards.
 * Keep this registry presentation-only; it must never affect catalog rules.
 * A missing mark intentionally falls back to the accessible initials badge.
 */
const LOCAL_BRAND_ASSETS: Record<string, string> = {};

export function canonicalBrandSlug(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("es-MX")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function brandLogoPath(value: unknown) {
  const slug = canonicalBrandSlug(value);
  return LOCAL_BRAND_ASSETS[slug] ?? null;
}

export const localBrandLogoCount = Object.keys(LOCAL_BRAND_ASSETS).length;
