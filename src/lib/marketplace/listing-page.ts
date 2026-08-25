import "server-only";

import { notFound, redirect } from "next/navigation";

import { requireVerifiedMarketplacePartner } from "@/lib/auth/marketplace-authorization";
import { getMarketplaceListingDetail } from "@/lib/marketplace/listing-data";
import { partnerEditableListingStatuses } from "@/lib/marketplace/listing-rules";

export async function requireEditableListingPage(listingId: string) {
  await requireVerifiedMarketplacePartner(
    `/partner/publicaciones/${listingId}`,
  );
  const detail = await getMarketplaceListingDetail(listingId);
  if (!detail.listing || !detail.version || detail.error) notFound();
  if (!partnerEditableListingStatuses.has(detail.listing.status)) {
    redirect(`/partner/publicaciones/${listingId}`);
  }
  return { ...detail, listing: detail.listing, version: detail.version };
}
