/**
 * Local, source-controlled brand marks for Mi Golf cards.
 * Keep this registry presentation-only; it must never affect catalog rules.
 * A missing mark intentionally falls back to the accessible initials badge.
 */
const LOCAL_BRAND_ASSETS: Record<string, string> = {
  callaway: "/brands/callaway.svg",
  "cleveland-golf": "/brands/cleveland-golf.svg",
  ping: "/brands/ping.svg",
  taylormade: "/brands/taylormade.svg",
  titleist: "/brands/titleist.svg",
};

export type BrandAssetRequest = {
  brandId?: string | null;
  brandSlug?: string | null;
  brandName?: string | null;
};

export type BrandAsset = {
  logoSrc: string | null;
  alt: string;
  hasLogo: boolean;
  slug: string;
};

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

export function resolveBrandAsset(input: BrandAssetRequest): BrandAsset {
  const slug = canonicalBrandSlug(input.brandSlug || input.brandName || input.brandId);
  const alt = String(input.brandName || input.brandSlug || "Marca").trim() || "Marca";
  const logoSrc = LOCAL_BRAND_ASSETS[slug] ?? null;
  return { logoSrc, alt, hasLogo: Boolean(logoSrc), slug };
}

export const localBrandLogoCount = Object.keys(LOCAL_BRAND_ASSETS).length;
