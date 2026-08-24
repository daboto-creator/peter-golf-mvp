import type { Metadata } from "next";
import Link from "next/link";

import { CatalogFeedback } from "@/components/operations/catalog-feedback";
import { CategoryForm } from "@/components/operations/taxonomy-forms";
import { Button } from "@/components/ui/button";
import { listOperationalCategories } from "@/lib/catalog/operational-taxonomies";

export const metadata: Metadata = {
  title: "Nueva categoría | Best Round Pro Shop",
};

export default async function NewCategoryPage() {
  const categories = await listOperationalCategories();
  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="ghost" className="-ml-2">
          <Link href="/operacion/taxonomias/categorias">
            ← Volver a categorías
          </Link>
        </Button>
        <h1 className="text-pg-black mt-4 text-4xl font-semibold tracking-[-0.035em]">
          Crear categoría
        </h1>
        <p className="text-muted-foreground mt-3">
          El padre debe estar activo. El orden acepta enteros no negativos.
        </p>
      </div>
      {categories.error ? (
        <CatalogFeedback
          tone="error"
          message="No pudimos cargar las categorías padre. La creación está deshabilitada."
        />
      ) : null}
      <CategoryForm
        mode="create"
        defaultValues={{
          name: "",
          slug: "",
          description: "",
          status: "active",
          parentId: "",
          sortOrder: "0",
        }}
        parentOptions={
          categories.data
            ?.filter((item) => item.status === "active")
            .map((item) => ({ id: item.id, displayName: item.displayName })) ??
          []
        }
        disabled={Boolean(categories.error)}
      />
    </div>
  );
}
