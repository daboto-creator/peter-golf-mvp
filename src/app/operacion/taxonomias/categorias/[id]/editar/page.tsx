import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { CatalogFeedback } from "@/components/operations/catalog-feedback";
import { CategoryForm } from "@/components/operations/taxonomy-forms";
import { TaxonomyStateActions } from "@/components/operations/taxonomy-state-actions";
import { TaxonomyStatusBadge } from "@/components/operations/taxonomy-status-badge";
import { Button } from "@/components/ui/button";
import {
  findOperationalCategory,
  listOperationalCategories,
} from "@/lib/catalog/operational-taxonomies";
import { wouldCreateCategoryCycle } from "@/lib/catalog/taxonomy-validation";

export const metadata: Metadata = {
  title: "Editar categoría | Best Round Pro Shop",
};

export default async function EditCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creada?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  const categories = await listOperationalCategories();
  if (categories.error)
    return (
      <CatalogFeedback
        tone="error"
        title="No pudimos cargar la categoría"
        message="Inténtalo nuevamente desde el listado."
      />
    );
  const category = findOperationalCategory(categories.data, id);
  if (!category) notFound();
  const parentOptions =
    categories.data
      ?.filter(
        (candidate) =>
          (candidate.status === "active" ||
            candidate.id === category.parentId) &&
          candidate.id !== category.id &&
          !wouldCreateCategoryCycle(category.id, candidate.id, categories.data),
      )
      .map((candidate) => ({
        id: candidate.id,
        displayName: `${candidate.displayName}${candidate.status === "archived" ? " (archivada · relación actual)" : ""}`,
      })) ?? [];
  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="ghost" className="-ml-2">
          <Link href="/operacion/taxonomias/categorias">
            ← Volver a categorías
          </Link>
        </Button>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-pg-black text-4xl font-semibold tracking-[-0.035em]">
            Editar categoría
          </h1>
          <TaxonomyStatusBadge status={category.status} />
        </div>
        <p className="text-muted-foreground mt-3">
          {category.productCount} productos · {category.childCount} categorías
          hijas.
        </p>
      </div>
      {query.creada === "1" ? (
        <CatalogFeedback
          tone="success"
          message="La categoría se creó correctamente."
        />
      ) : null}
      <TaxonomyStateActions
        kind="category"
        id={category.id}
        status={category.status}
      />
      <CategoryForm
        mode="edit"
        categoryId={category.id}
        defaultValues={{
          name: category.name,
          slug: category.slug,
          description: category.description ?? "",
          status: category.status,
          parentId: category.parentId ?? "",
          sortOrder: String(category.sortOrder),
        }}
        parentOptions={parentOptions}
      />
    </div>
  );
}
