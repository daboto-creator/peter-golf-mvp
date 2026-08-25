import { ListingPhotosForm } from "@/components/marketplace/listing-forms";
import { ListingWizardHeader } from "@/components/marketplace/listing-wizard";
import { getMarketplaceListingTaxonomy } from "@/lib/marketplace/listing-data";
import { requireEditableListingPage } from "@/lib/marketplace/listing-page";

export default async function ListingPhotosStep({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await requireEditableListingPage(id);
  const taxonomy = await getMarketplaceListingTaxonomy(
    detail.version.category_id,
  );
  const requirementsByType = new Map<
    string,
    (typeof taxonomy.photoRequirements)[number]
  >();
  for (const requirement of taxonomy.photoRequirements) {
    if (
      requirement.condition !== null &&
      detail.version.condition !== null &&
      requirement.condition !== detail.version.condition
    )
      continue;
    const current = requirementsByType.get(requirement.image_type);
    if (!current || requirement.requirement === "REQUIRED")
      requirementsByType.set(requirement.image_type, requirement);
  }
  const requirements = [...requirementsByType.values()]
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((requirement) =>
      detail.version.condition === null && requirement.condition !== null
        ? {
            ...requirement,
            requirement: "RECOMMENDED" as const,
            label: `${requirement.label} · necesaria si es ${requirement.condition === "used" ? "usado" : "nuevo"}`,
          }
        : requirement,
    );
  return (
    <div className="space-y-8">
      <ListingWizardHeader
        listingId={id}
        current="fotos"
        title="Muestra el producto con claridad"
      />
      <p className="text-muted-foreground max-w-2xl">
        Las vistas requeridas ayudan a revisar la condición. Las recomendadas no
        bloquean tu avance.
      </p>
      <ListingPhotosForm
        listingId={id}
        lockVersion={detail.listing.lock_version}
        requirements={requirements}
        images={detail.images.map((image) => ({
          ...image,
          signedUrl: image.signedUrl ?? undefined,
        }))}
      />
    </div>
  );
}
