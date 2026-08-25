import { ListingIdentityForm } from "@/components/marketplace/listing-forms";
import { ListingWizardHeader } from "@/components/marketplace/listing-wizard";
import { Card, CardContent } from "@/components/ui/card";
import { getMarketplaceListingTaxonomy } from "@/lib/marketplace/listing-data";
import { requireEditableListingPage } from "@/lib/marketplace/listing-page";
import { suggestListingTitle } from "@/lib/marketplace/listing-rules";

export default async function ListingProductStep({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await requireEditableListingPage(id);
  const taxonomy = await getMarketplaceListingTaxonomy(
    detail.version.category_id,
  );
  const brandName = taxonomy.brands.find(
    (brand) => brand.id === detail.version.brand_id,
  )?.name;
  const modelName =
    detail.version.catalog_product_models?.model_name ??
    detail.version.proposed_model;
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <ListingWizardHeader
        listingId={id}
        current="producto"
        title="Identifica el producto"
      />
      <Card>
        <CardContent className="pt-6">
          <ListingIdentityForm
            listingId={id}
            lockVersion={detail.listing.lock_version}
            values={{
              canonical_model_id: detail.version.canonical_model_id,
              brand_id: detail.version.brand_id,
              proposed_brand: detail.version.proposed_brand,
              proposed_model: detail.version.proposed_model,
              title:
                detail.version.title ??
                suggestListingTitle([
                  brandName ?? detail.version.proposed_brand,
                  modelName,
                  detail.version.categories?.name,
                ]),
              description: detail.version.description,
            }}
            brands={taxonomy.brands}
            models={taxonomy.models}
          />
        </CardContent>
      </Card>
    </div>
  );
}
