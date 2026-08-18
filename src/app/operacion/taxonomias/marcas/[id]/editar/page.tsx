import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { CatalogFeedback } from "@/components/operations/catalog-feedback";
import { BrandForm } from "@/components/operations/taxonomy-forms";
import { TaxonomyStateActions } from "@/components/operations/taxonomy-state-actions";
import { TaxonomyStatusBadge } from "@/components/operations/taxonomy-status-badge";
import { Button } from "@/components/ui/button";
import { getOperationalBrand } from "@/lib/catalog/operational-taxonomies";

export const metadata: Metadata = { title: "Editar marca | Peter Golf" };

export default async function EditBrandPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creada?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  const result = await getOperationalBrand(id);
  if (!result.error && !result.data) notFound();
  if (result.error || !result.data)
    return (
      <CatalogFeedback
        tone="error"
        title="No pudimos cargar la marca"
        message="Inténtalo nuevamente desde el listado."
      />
    );
  const brand = result.data;
  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="ghost" className="-ml-2">
          <Link href="/operacion/taxonomias/marcas">← Volver a marcas</Link>
        </Button>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-pg-black text-4xl font-semibold tracking-[-0.035em]">
            Editar marca
          </h1>
          <TaxonomyStatusBadge status={brand.status} />
        </div>
        <p className="text-muted-foreground mt-3">
          {brand.productCount} productos asociados.
        </p>
      </div>
      {query.creada === "1" ? (
        <CatalogFeedback
          tone="success"
          message="La marca se creó correctamente."
        />
      ) : null}
      <TaxonomyStateActions kind="brand" id={brand.id} status={brand.status} />
      <BrandForm
        mode="edit"
        brandId={brand.id}
        defaultValues={{
          name: brand.name,
          slug: brand.slug,
          description: brand.description ?? "",
          status: brand.status,
        }}
      />
    </div>
  );
}
