/**
 * Local, source-controlled brand marks for Mi Golf cards.
 * Keep this registry presentation-only; it must never affect catalog rules.
 * A missing mark intentionally falls back to the accessible initials badge.
 */
const LOCAL_BRAND_ASSETS: Record<string, string> = {
  "adams-golf": "/brands/adams-golf.png",
  "ben-hogan-golf": "/brands/ben-hogan-golf.png",
  "bridgestone-golf": "/brands/bridgestone-golf.png",
  callaway: "/brands/callaway.svg",
  "cleveland-golf": "/brands/cleveland-golf.svg",
  cobra: "/brands/cobra.svg",
  honma: "/brands/honma.png",
  mizuno: "/brands/mizuno.svg",
  odyssey: "/brands/odyssey.svg",
  ping: "/brands/ping.svg",
  pxg: "/brands/pxg.svg",
  "scotty-cameron": "/brands/scotty-cameron.png",
  srixon: "/brands/srixon.svg",
  "sub-70": "/brands/sub-70.png",
  taylormade: "/brands/taylormade.svg",
  titleist: "/brands/titleist.svg",
  "tour-edge": "/brands/tour-edge.png",
  "wilson-staff": "/brands/wilson-staff.png",
};

export const CURATED_BRAND_SLUGS = [
  "adams-golf",
  "ben-hogan-golf",
  "bridgestone-golf",
  "callaway",
  "cleveland-golf",
  "cobra",
  "honma",
  "mizuno",
  "odyssey",
  "ping",
  "pxg",
  "scotty-cameron",
  "srixon",
  "sub-70",
  "taylormade",
  "titleist",
  "tour-edge",
  "wilson-staff",
] as const;

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
