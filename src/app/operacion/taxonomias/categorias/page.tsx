import type { Metadata } from "next";
import Link from "next/link";

import { CatalogFeedback } from "@/components/operations/catalog-feedback";
import { CategoryList } from "@/components/operations/taxonomy-lists";
import { Button } from "@/components/ui/button";
import { listOperationalCategories } from "@/lib/catalog/operational-taxonomies";

export const metadata: Metadata = { title: "Categorías | Best Round Pro Shop" };

export default async function CategoriesPage() {
  const result = await listOperationalCategories();
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Button asChild variant="ghost" className="-ml-2">
            <Link href="/operacion/taxonomias">← Volver a taxonomías</Link>
          </Button>
          <h1 className="text-pg-black mt-4 text-4xl font-semibold tracking-[-0.035em]">
            Categorías
          </h1>
          <p className="text-muted-foreground mt-3">
            Revisa la jerarquía, el orden y las dependencias del catálogo.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/operacion/taxonomias/categorias/nueva">
            Crear categoría
          </Link>
        </Button>
      </div>
      {result.error ? (
        <CatalogFeedback
          tone="error"
          title="No pudimos cargar las categorías"
          message="Inténtalo nuevamente. No se expusieron detalles internos."
        />
      ) : result.data.length === 0 ? (
        <section className="rounded-xl border border-dashed bg-white px-6 py-14 text-center">
          <h2 className="text-xl font-semibold">Aún no hay categorías</h2>
          <p className="text-muted-foreground mt-3">
            Crea una categoría raíz para comenzar la jerarquía.
          </p>
          <Button asChild className="mt-6">
            <Link href="/operacion/taxonomias/categorias/nueva">
              Crear categoría
            </Link>
          </Button>
        </section>
      ) : (
        <CategoryList categories={result.data} />
      )}
    </div>
  );
}
