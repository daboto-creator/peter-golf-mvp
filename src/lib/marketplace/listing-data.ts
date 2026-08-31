import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type ListingStatus = Database["public"]["Enums"]["marketplace_listing_status"];

const LISTING_PAGE_SIZE = 20;
const LISTING_IMAGE_URL_TTL_SECONDS = 5 * 60;

export async function getMarketplaceListingTaxonomy(categoryId?: string) {
  const client = await createClient();
  const [categories, brands, models, photoRequirements] = await Promise.all([
    client
      .from("categories")
      .select(
        "id, name, slug, parent_id, category_spec_profiles(family, club_type, bag_type, set_type)",
      )
      .eq("status", "active")
      .order("sort_order"),
    client
      .from("brands")
      .select("id, name, slug")
      .eq("status", "active")
      .order("name"),
    categoryId
      ? client
          .from("catalog_product_models")
          .select("id, brand_id, category_id, model_name")
          .eq("category_id", categoryId)
          .eq("status", "active")
          .order("model_name")
      : Promise.resolve({ data: [], error: null }),
    categoryId
      ? client
          .from("marketplace_listing_photo_requirements")
          .select("id, condition, image_type, requirement, label, sort_order")
          .eq("category_id", categoryId)
          .order("sort_order")
      : Promise.resolve({ data: [], error: null }),
  ]);
  return {
    categories: categories.data ?? [],
    brands: brands.data ?? [],
    models: models.data ?? [],
    photoRequirements: photoRequirements.data ?? [],
  };
}

async function signedImageMap(paths: string[]) {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  if (!uniquePaths.length) return new Map<string, string>();
  const client = await createClient();
  const { data } = await client.storage
    .from("marketplace-listing-images")
    .createSignedUrls(uniquePaths, LISTING_IMAGE_URL_TTL_SECONDS);
  return new Map(
    (data ?? [])
      .filter((entry) => entry.signedUrl)
      .map((entry) => [entry.path, entry.signedUrl]),
  );
}

export async function listCurrentPartnerListings(
  partnerId: string,
  page: number,
  status?: ListingStatus,
) {
  const client = await createClient();
  const start = (page - 1) * LISTING_PAGE_SIZE;
  let query = client
    .from("marketplace_listings")
    .select("*", { count: "exact" })
    .eq("partner_id", partnerId)
    .order("updated_at", { ascending: false })
    .range(start, start + LISTING_PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  const listings = await query;
  const versionIds = (listings.data ?? [])
    .map((listing) => listing.current_version_id)
    .filter((entry): entry is string => Boolean(entry));
  const [versions, imageAssignments, publicationReadiness] = await Promise.all([
    versionIds.length
      ? client
          .from("marketplace_listing_versions")
          .select(
            "id, listing_id, title, proposed_brand, proposed_model, condition, condition_grade, quantity, version_number, category_id, categories(name), brands(name), catalog_product_models(model_name)",
          )
          .in("id", versionIds)
      : Promise.resolve({ data: [], error: null }),
    versionIds.length
      ? client
          .from("marketplace_listing_version_images")
          .select(
            "version_id, sort_order, alt_text, is_sensitive, marketplace_listing_images(storage_path)",
          )
          .in("version_id", versionIds)
          .eq("is_sensitive", false)
          .order("sort_order")
      : Promise.resolve({ data: [], error: null }),
    client.rpc("get_marketplace_publication_readiness"),
  ]);
  const paths = (imageAssignments.data ?? []).flatMap((assignment) => {
    const image = assignment.marketplace_listing_images;
    return image?.storage_path ? [image.storage_path] : [];
  });
  const urls = await signedImageMap(paths);
  const versionById = new Map(
    (versions.data ?? []).map((version) => [version.id, version]),
  );
  const imageByVersion = new Map<
    string,
    { url: string; alt: string } | undefined
  >();
  const publicationByListing = new Map(
    (publicationReadiness.data ?? []).map((entry) => [entry.listing_id, entry]),
  );
  for (const assignment of imageAssignments.data ?? []) {
    if (imageByVersion.has(assignment.version_id) || assignment.is_sensitive)
      continue;
    const path = assignment.marketplace_listing_images?.storage_path;
    const url = path ? urls.get(path) : undefined;
    if (url)
      imageByVersion.set(assignment.version_id, {
        url,
        alt: assignment.alt_text,
      });
  }
  return {
    data: (listings.data ?? []).map((listing) => ({
      ...listing,
      currentVersion: listing.current_version_id
        ? versionById.get(listing.current_version_id)
        : undefined,
      primaryImage: listing.current_version_id
        ? imageByVersion.get(listing.current_version_id)
        : undefined,
      publicationReadiness: publicationByListing.get(listing.id),
    })),
    count: listings.count ?? 0,
    error:
      listings.error ??
      versions.error ??
      imageAssignments.error ??
      publicationReadiness.error,
    page,
    pageSize: LISTING_PAGE_SIZE,
  };
}

export async function getMarketplaceListingDetail(listingId: string) {
  const client = await createClient();
  const listingResult = await client
    .from("marketplace_listings")
    .select("*")
    .eq("id", listingId)
    .maybeSingle();
  if (!listingResult.data) return { listing: null, error: listingResult.error };
  const listing = listingResult.data;
  const currentVersionId = listing.current_version_id;
  if (!currentVersionId) return { listing, error: null };
  const [
    version,
    assignments,
    feedback,
    history,
    inventory,
    readiness,
    publicationReadiness,
  ] = await Promise.all([
    client
      .from("marketplace_listing_versions")
      .select(
        "*, categories(name, slug, category_spec_profiles(family, club_type, bag_type, set_type)), brands(name), catalog_product_models(model_name, brand_id)",
      )
      .eq("id", currentVersionId)
      .maybeSingle(),
    client
      .from("marketplace_listing_version_images")
      .select(
        "version_id, image_id, image_type, requirement, sort_order, alt_text, is_sensitive, marketplace_listing_images(storage_path, mime_type, size_bytes, width_pixels, height_pixels, sha256)",
      )
      .eq("version_id", currentVersionId)
      .order("sort_order"),
    client
      .from("marketplace_listing_review_requests")
      .select("id, area, visibility, status, comment, created_at")
      .eq("listing_id", listingId)
      .order("created_at", { ascending: false }),
    client
      .from("marketplace_listing_status_history")
      .select(
        "id, listing_version_id, from_status, to_status, reason, lock_version, created_at",
      )
      .eq("listing_id", listingId)
      .order("created_at", { ascending: false }),
    client
      .from("marketplace_listing_inventory")
      .select("*")
      .eq("listing_id", listingId)
      .maybeSingle(),
    client
      .rpc("get_marketplace_listing_readiness", {
        requested_listing_id: listingId,
      })
      .maybeSingle(),
    client
      .rpc("get_marketplace_publication_readiness", {
        requested_listing_id: listingId,
      })
      .maybeSingle(),
  ]);
  const paths = (assignments.data ?? []).flatMap((assignment) => {
    const path = assignment.marketplace_listing_images?.storage_path;
    return path ? [path] : [];
  });
  const urls = await signedImageMap(paths);
  return {
    listing,
    version: version.data,
    images: (assignments.data ?? []).map((assignment) => {
      const path = assignment.marketplace_listing_images?.storage_path;
      return { ...assignment, signedUrl: path ? urls.get(path) : undefined };
    }),
    feedback: feedback.data ?? [],
    history: history.data ?? [],
    inventory: inventory.data,
    readiness: readiness.data,
    publicationReadiness: publicationReadiness.data,
    error:
      version.error ??
      assignments.error ??
      feedback.error ??
      history.error ??
      inventory.error ??
      readiness.error ??
      publicationReadiness.error,
  };
}

export async function listMarketplaceListingsForOperations(
  page: number,
  filters: {
    status?: ListingStatus;
    categoryId?: string;
    partnerId?: string;
    dateFrom?: string;
  },
) {
  const client = await createClient();
  const start = (page - 1) * LISTING_PAGE_SIZE;
  let query = client
    .from("marketplace_listings")
    .select(
      "*, partner_profiles(id, legal_type, commercial_name, first_name, last_name)",
      { count: "exact" },
    )
    .order("updated_at", { ascending: false })
    .range(start, start + LISTING_PAGE_SIZE - 1);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.partnerId) query = query.eq("partner_id", filters.partnerId);
  if (filters.dateFrom)
    query = query.gte("created_at", `${filters.dateFrom}T00:00:00.000Z`);
  const result = await query;
  const currentIds = (result.data ?? [])
    .map((entry) => entry.current_version_id)
    .filter((entry): entry is string => Boolean(entry));
  let versionsQuery = client
    .from("marketplace_listing_versions")
    .select(
      "id, listing_id, title, proposed_brand, proposed_model, version_number, quantity, category_id, categories(name), brands(name), catalog_product_models(model_name)",
    )
    .in(
      "id",
      currentIds.length ? currentIds : ["00000000-0000-0000-0000-000000000000"],
    );
  if (filters.categoryId)
    versionsQuery = versionsQuery.eq("category_id", filters.categoryId);
  const [versions, publicationReadiness] = await Promise.all([
    versionsQuery,
    client.rpc("get_marketplace_publication_readiness"),
  ]);
  const versionById = new Map(
    (versions.data ?? []).map((version) => [version.id, version]),
  );
  const publicationByListing = new Map(
    (publicationReadiness.data ?? []).map((entry) => [entry.listing_id, entry]),
  );
  const data = (result.data ?? [])
    .filter(
      (listing) =>
        !filters.categoryId ||
        (listing.current_version_id &&
          versionById.has(listing.current_version_id)),
    )
    .map((listing) => ({
      ...listing,
      currentVersion: listing.current_version_id
        ? versionById.get(listing.current_version_id)
        : undefined,
      publicationReadiness: publicationByListing.get(listing.id),
    }));
  return {
    data,
    count: filters.categoryId ? data.length : (result.count ?? 0),
    error: result.error ?? versions.error ?? publicationReadiness.error,
    page,
    pageSize: LISTING_PAGE_SIZE,
  };
}

export async function getMarketplaceListingForOperations(listingId: string) {
  const client = await createClient();
  const detail = await getMarketplaceListingDetail(listingId);
  if (!detail.listing) return detail;
  const [partner, models] = await Promise.all([
    client
      .from("partner_profiles")
      .select(
        "id, legal_type, status, commercial_name, first_name, last_name, city, state",
      )
      .eq("id", detail.listing.partner_id)
      .maybeSingle(),
    detail.version
      ? client
          .from("catalog_product_models")
          .select("id, brand_id, category_id, model_name, brands(name)")
          .eq("category_id", detail.version.category_id)
          .eq("status", "active")
          .order("model_name")
      : Promise.resolve({ data: [], error: null }),
  ]);
  return {
    ...detail,
    partner: partner.data,
    models: models.data ?? [],
    error: detail.error ?? partner.error ?? models.error,
  };
}
