import { ListingInventoryForm } from "@/components/marketplace/listing-forms";
import { ListingWizardHeader } from "@/components/marketplace/listing-wizard";
import { Card, CardContent } from "@/components/ui/card";
import { requireEditableListingPage } from "@/lib/marketplace/listing-page";

export default async function ListingInventoryStep({
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
        current="inventario"
        title="Confirma disponibilidad"
      />
      <Card>
        <CardContent className="pt-6">
          <ListingInventoryForm
            listingId={id}
            lockVersion={detail.listing.lock_version}
            quantity={detail.version.quantity}
            custody={detail.version.custody}
            fulfillment={detail.version.fulfillment}
          />
        </CardContent>
      </Card>
    </div>
  );
}
