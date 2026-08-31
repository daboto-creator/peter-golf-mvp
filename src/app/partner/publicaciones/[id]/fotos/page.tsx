import { ListingPhotosForm } from "@/components/marketplace/listing-forms";
import { ListingWizardHeader } from "@/components/marketplace/listing-wizard";
import { getMarketplaceListingTaxonomy } from "@/lib/marketplace/listing-data";
import { requireEditableListingPage } from "@/lib/marketplace/listing-page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { analyzeListingImages } from "@/lib/marketplace/image-intelligence";

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
  const imageAnalysis = analyzeListingImages({
    images: detail.images.map((image) => ({
      sha256: image.marketplace_listing_images?.sha256 ?? image.image_id,
      widthPixels: image.marketplace_listing_images?.width_pixels ?? null,
      heightPixels: image.marketplace_listing_images?.height_pixels ?? null,
      imageType: image.image_type,
    })),
    isClub:
      detail.version.categories?.category_spec_profiles?.family === "club",
    declaredBrand:
      detail.version.brands?.name ?? detail.version.proposed_brand ?? null,
    declaredModel:
      detail.version.catalog_product_models?.model_name ??
      detail.version.proposed_model ??
      null,
  });
  return (
    <div className="space-y-8">
      <ListingWizardHeader
        listingId={id}
        current="fotos"
        title="Muestra el producto con claridad"
      />
      <Card>
        <CardHeader>
          <CardTitle>Prepara buenas fotografías</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6">
          <p>
            Usa buena luz y un fondo limpio o neutro. Procura que el producto
            ocupe la mayor parte de la imagen. Evita filtros, reflejos fuertes,
            objetos alrededor, fotografías borrosas, collages, marcas de agua o
            texto sobre la imagen.
          </p>
          <p>
            Las fotografías deben mostrar el producto real que estás vendiendo.
            Si tiene golpes, rayones o desgaste, muéstralos claramente.
          </p>
          {detail.version.categories?.category_spec_profiles?.family ===
          "club" ? (
            <p>
              Toma al menos 5 fotos reales; recomendamos 6–8: palo completo,
              cabeza, cara, corona, suela, shaft, etiqueta/modelo del shaft,
              grip, desgaste o daños y número de serie cuando sea visible. Las
              imágenes del fabricante sólo pueden ser complementarias.
            </p>
          ) : null}
          <p className="rounded-lg bg-black/5 p-3">
            {imageAnalysis.summary}. Las fotos nunca prueban autenticidad por sí
            solas.
          </p>
        </CardContent>
      </Card>
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
