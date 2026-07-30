import type { Metadata } from "next";
import Link from "next/link";

import { ProductGrid } from "@/components/catalog/product-grid";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { listPublicProducts } from "@/lib/catalog/public-products";

export const metadata: Metadata = {
  title: "Productos | Peter Golf",
  description:
    "Explora equipo de golf nuevo y seminuevo con condición, precio y disponibilidad claramente indicados.",
};

export default async function ProductsPage() {
  const result = await listPublicProducts();

  return (
    <main className="bg-muted/30 min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="rounded-sm text-lg font-semibold focus-visible:ring-2 focus-visible:outline-none"
          >
            Peter Golf
          </Link>
          <span className="text-muted-foreground text-sm">
            Catálogo público
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="mb-10 max-w-2xl">
          <p className="mb-3 text-sm font-medium tracking-wide text-emerald-800 uppercase">
            Equipo para elegir con confianza
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Productos
          </h1>
          <p className="text-muted-foreground mt-4 text-base leading-7 sm:text-lg">
            Conoce opciones nuevas y seminuevas. La condición, el precio y la
            forma de entrega se muestran con claridad antes de cualquier
            decisión.
          </p>
        </div>

        {result.error ? (
          <Alert>
            <AlertTitle>No pudimos cargar el catálogo</AlertTitle>
            <AlertDescription>
              Intenta nuevamente en unos minutos. Si el problema continúa,
              podemos ayudarte a revisar opciones directamente.
            </AlertDescription>
          </Alert>
        ) : result.data.length > 0 ? (
          <ProductGrid products={result.data} />
        ) : (
          <section className="rounded-2xl border border-dashed bg-white px-6 py-16 text-center">
            <h2 className="text-xl font-semibold">
              Estamos preparando el catálogo
            </h2>
            <p className="text-muted-foreground mx-auto mt-3 max-w-lg leading-6">
              Aún no hay productos publicados. Vuelve pronto para conocer las
              opciones disponibles.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
