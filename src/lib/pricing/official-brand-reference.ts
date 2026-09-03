export type OfficialBrandReferenceStatus =
  "OFFICIAL_PRICE_FOUND" | "OFFICIAL_PRICE_NOT_AVAILABLE";

export type OfficialBrandReference = {
  status: OfficialBrandReferenceStatus;
  brand: string;
  domain: string | null;
  priceMxnMinor: number | null;
  url: string | null;
  checkedAt: string;
  source: "OFFICIAL_MANUFACTURER";
};

const OFFICIAL_DOMAINS: Record<string, string> = {
  titleist: "titleist.com",
  taylormade: "taylormadegolf.com",
  callaway: "callawaygolf.com",
  ping: "ping.com",
  cobra: "cobragolf.com",
  mizuno: "mizunogolf.com",
  srixon: "srixon.com",
  cleveland: "clevelandgolf.com",
  odyssey: "odyssey.callawaygolf.com",
  "scotty cameron": "scottycameron.com",
};

function key(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function officialBrandDomain(
  brand: string | null | undefined,
): string | null {
  return OFFICIAL_DOMAINS[key(brand)] ?? null;
}

export function isOfficialBrandUrl(
  brand: string | null | undefined,
  value: string | null | undefined,
): boolean {
  const domain = officialBrandDomain(brand);
  if (!domain || !value) return false;
  try {
    const hostname = new URL(value).hostname
      .toLowerCase()
      .replace(/^www\./, "");
    return hostname === domain || hostname.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}

export interface OfficialBrandReferenceResolver {
  resolve(input: {
    brand: string | null;
    model: string | null;
    market: "MX";
  }): Promise<OfficialBrandReference>;
}

/** Safe default: no arbitrary URL fetches and no invented MSRP. */
export class UnavailableOfficialBrandReferenceResolver implements OfficialBrandReferenceResolver {
  async resolve(input: {
    brand: string | null;
    model: string | null;
    market: "MX";
  }) {
    return {
      status: "OFFICIAL_PRICE_NOT_AVAILABLE" as const,
      brand: input.brand ?? "",
      domain: officialBrandDomain(input.brand),
      priceMxnMinor: null,
      url: null,
      checkedAt: new Date().toISOString(),
      source: "OFFICIAL_MANUFACTURER" as const,
    };
  }
}
