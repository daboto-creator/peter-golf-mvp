import type { Metadata } from "next";
import Link from "next/link";

import { CreateListingForm } from "@/components/marketplace/listing-forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireVerifiedMarketplacePartner } from "@/lib/auth/marketplace-authorization";
import { getMarketplaceListingTaxonomy } from "@/lib/marketplace/listing-data";

export const metadata: Metadata = {
  title: "Nueva publicación Partner | Best Round Pro Shop",
};

export default async function NewMarketplaceListingPage() {
  await requireVerifiedMarketplacePartner("/partner/publicaciones/nueva");
  const taxonomy = await getMarketplaceListingTaxonomy();
  const parentIds = new Set(
    taxonomy.categories.flatMap((category) =>
      category.parent_id ? [category.parent_id] : [],
    ),
  );
  const categories = taxonomy.categories
    .filter((category) => !parentIds.has(category.id))
    .map((category) => ({ id: category.id, name: category.name }));
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
          Nueva publicación
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em]">
          ¿Qué estás vendiendo?
        </h1>
        <p className="text-muted-foreground mt-3">
          Empezaremos por la categoría para mostrar sólo los detalles que
          aplican.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Producto</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateListingForm categories={categories} />
        </CardContent>
      </Card>
      <Button asChild variant="ghost">
        <Link href="/partner/publicaciones">Cancelar</Link>
      </Button>
    </div>
  );
}
