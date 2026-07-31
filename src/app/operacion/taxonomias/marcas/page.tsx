import type { Metadata } from "next";
import Link from "next/link";

import { CatalogFeedback } from "@/components/operations/catalog-feedback";
import { BrandList } from "@/components/operations/taxonomy-lists";
import { Button } from "@/components/ui/button";
import { listOperationalBrands } from "@/lib/catalog/operational-taxonomies";

export const metadata: Metadata = { title: "Marcas | Peter Golf" };

export default async function BrandsPage() {
  const result = await listOperationalBrands();
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Button asChild variant="ghost" className="-ml-2">
            <Link href="/operacion/taxonomias">← Volver a taxonomías</Link>
          </Button>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Marcas</h1>
          <p className="text-muted-foreground mt-3">
            Activa o archiva marcas sin borrar productos históricos.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/operacion/taxonomias/marcas/nueva">Crear marca</Link>
        </Button>
      </div>
      {result.error ? (
        <CatalogFeedback
          tone="error"
          title="No pudimos cargar las marcas"
          message="Inténtalo nuevamente. No se expusieron detalles internos."
        />
      ) : result.data.length === 0 ? (
        <section className="rounded-xl border border-dashed bg-white px-6 py-14 text-center">
          <h2 className="text-xl font-semibold">Aún no hay marcas</h2>
          <p className="text-muted-foreground mt-3">
            Crea la primera marca para empezar a clasificar productos.
          </p>
          <Button asChild className="mt-6">
            <Link href="/operacion/taxonomias/marcas/nueva">Crear marca</Link>
          </Button>
        </section>
      ) : (
        <BrandList brands={result.data} />
      )}
    </div>
  );
}
