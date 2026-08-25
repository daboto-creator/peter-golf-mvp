import { ListingSpecsForm } from "@/components/marketplace/listing-forms";
import { ListingWizardHeader } from "@/components/marketplace/listing-wizard";
import { Card, CardContent } from "@/components/ui/card";
import { requireEditableListingPage } from "@/lib/marketplace/listing-page";
import { getSpecFields } from "@/lib/marketplace/listing-rules";

export default async function ListingDetailsStep({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await requireEditableListingPage(id);
  const profile = detail.version.categories?.category_spec_profiles ?? null;
  const fields = getSpecFields(profile);
  const values =
    detail.version.specifications &&
    typeof detail.version.specifications === "object" &&
    !Array.isArray(detail.version.specifications)
      ? (detail.version.specifications as Record<string, unknown>)
      : {};
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <ListingWizardHeader
        listingId={id}
        current="detalles"
        title="Agrega las especificaciones"
      />
      <Card>
        <CardContent className="pt-6">
          <ListingSpecsForm
            listingId={id}
            lockVersion={detail.listing.lock_version}
            profile={profile}
            fields={fields}
            values={values}
          />
        </CardContent>
      </Card>
    </div>
  );
}
