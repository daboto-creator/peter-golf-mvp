import type { Metadata } from "next";
import Link from "next/link";

import { CatalogFeedback } from "@/components/operations/catalog-feedback";
import { OperationalProductList } from "@/components/operations/operational-product-list";
import { Button } from "@/components/ui/button";
import { listOperationalProducts } from "@/lib/catalog/operational-products";

export const metadata: Metadata = {
  title: "Catálogo operativo | Peter Golf",
};

export default async function OperationalCatalogPage() {
  const result = await listOperationalProducts();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium tracking-wide text-emerald-800 uppercase">
            Gestión de catálogo
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Productos
          </h1>
          <p className="text-muted-foreground mt-3">
            Revisa borradores, productos publicados y registros archivados.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/operacion/catalogo/nuevo">Crear producto</Link>
        </Button>
      </div>

      {result.error ? (
        <CatalogFeedback
          tone="error"
          title="No pudimos cargar el catálogo operativo"
          message="Inténtalo nuevamente. No se expusieron detalles internos del error."
        />
      ) : result.data.length === 0 ? (
        <section className="rounded-xl border border-dashed bg-white px-6 py-14 text-center">
          <h2 className="text-xl font-semibold">El catálogo está vacío</h2>
          <p className="text-muted-foreground mx-auto mt-3 max-w-lg">
            Crea el primer producto base cuando existan marcas y categorías
            activas.
          </p>
          <Button asChild className="mt-6">
            <Link href="/operacion/catalogo/nuevo">Crear producto</Link>
          </Button>
        </section>
      ) : (
        <OperationalProductList products={result.data} />
      )}
    </div>
  );
}
