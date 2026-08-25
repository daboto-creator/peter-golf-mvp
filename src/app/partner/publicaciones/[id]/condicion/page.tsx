import { ListingConditionForm } from "@/components/marketplace/listing-forms";
import { ListingWizardHeader } from "@/components/marketplace/listing-wizard";
import { Card, CardContent } from "@/components/ui/card";
import { requireEditableListingPage } from "@/lib/marketplace/listing-page";

export default async function ListingConditionStep({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await requireEditableListingPage(id);
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <ListingWizardHeader
        listingId={id}
        current="condicion"
        title="Describe la condición real"
      />
      <Card>
        <CardContent className="pt-6">
          <ListingConditionForm
            listingId={id}
            lockVersion={detail.listing.lock_version}
            values={{
              condition: detail.version.condition,
              condition_grade: detail.version.condition_grade,
              condition_notes: detail.version.condition_notes,
              declared_defects: detail.version.declared_defects,
              defects_acknowledged: detail.version.defects_acknowledged,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
