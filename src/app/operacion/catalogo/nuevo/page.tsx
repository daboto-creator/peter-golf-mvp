import type { Metadata } from "next";
import Link from "next/link";

import { CatalogFeedback } from "@/components/operations/catalog-feedback";
import { ProductForm } from "@/components/operations/product-form";
import { Button } from "@/components/ui/button";
import {
  emptyProductFormValues,
  listActiveCatalogReferences,
} from "@/lib/catalog/operational-products";

export const metadata: Metadata = {
  title: "Nuevo producto | Peter Golf",
};

export default async function NewProductPage() {
  const references = await listActiveCatalogReferences();

  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="ghost" className="-ml-2">
          <Link href="/operacion/catalogo">← Volver al catálogo</Link>
        </Button>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Crear producto
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl leading-7">
          Captura la información comercial base. Variantes, imágenes, inventario
          y costos permanecen fuera de este flujo.
        </p>
      </div>

      {references.error ? (
        <CatalogFeedback
          tone="error"
          title="No pudimos cargar marcas y categorías"
          message="La creación está deshabilitada hasta poder validar referencias activas."
        />
      ) : references.data.brands.length === 0 ||
        references.data.categories.length === 0 ? (
        <CatalogFeedback
          tone="info"
          title="Faltan referencias activas"
          message="Debe existir al menos una marca y una categoría activas antes de crear productos. Su administración todavía no forma parte de este bloque."
        />
      ) : null}

      <ProductForm
        mode="create"
        defaultValues={emptyProductFormValues}
        brands={references.data?.brands ?? []}
        categories={references.data?.categories ?? []}
      />
    </div>
  );
}
