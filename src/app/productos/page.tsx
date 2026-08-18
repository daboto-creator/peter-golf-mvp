import type { Metadata } from "next";
import Image from "next/image";

import { ProductGrid } from "@/components/catalog/product-grid";
import { PublicFooter } from "@/components/catalog/public-footer";
import { PublicHeader } from "@/components/catalog/public-header";
import { listPublicProducts } from "@/lib/catalog/public-products";

export const metadata: Metadata = {
  title: "Pro Shop | Peter Golf",
  description:
    "Explora equipo de golf nuevo y seminuevo con condición, precio y disponibilidad claramente indicados.",
};

export default async function ProductsPage() {
  const result = await listPublicProducts();

  return (
    <div className="bg-background min-h-screen">
      <PublicHeader />

      <main>
        <section className="bg-pg-warm-white border-b">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-16 md:grid-cols-[0.9fr_1.1fr] md:items-center lg:gap-16 lg:px-8 lg:py-20">
            <div className="max-w-2xl">
              <p className="before:bg-pg-gold flex items-center gap-3 text-xs font-semibold tracking-[0.2em] uppercase before:h-px before:w-8">
                Pro Shop
              </p>
              <h1 className="font-heading mt-5 text-[clamp(2.75rem,5vw,5rem)] leading-[0.98] font-bold tracking-[-0.045em] text-balance">
                Equipo seleccionado para jugar mejor.
              </h1>
              <p className="text-pg-charcoal mt-7 max-w-2xl text-base leading-8 sm:text-lg">
                Explora equipo nuevo y seminuevo seleccionado con criterio.
                Compara opciones con claridad y encuentra lo que tiene sentido
                para tu juego.
              </p>
            </div>

            <div className="relative aspect-[16/8] overflow-hidden rounded-[20px] bg-white md:aspect-[4/3] lg:aspect-[16/10]">
              <Image
                src="/images/home/pro-shop-equipment-temporary.jpg"
                alt="Bolsa con palos de golf, ropa, calzado y pelotas en una composición editorial"
                fill
                preload
                sizes="(max-width: 767px) calc(100vw - 2rem), (max-width: 1279px) 52vw, 42rem"
                className="object-cover object-center"
              />
              <p className="absolute right-4 bottom-4 rounded-lg bg-black/65 px-3 py-2 text-[0.65rem] font-semibold tracking-[0.14em] text-white uppercase backdrop-blur-sm sm:right-5 sm:bottom-5">
                Equipamiento para cada momento del juego
              </p>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <section aria-labelledby="catalog-heading">
            <div className="flex flex-col gap-4 border-b pb-7 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
                  Selección actual
                </p>
                <h2
                  id="catalog-heading"
                  className="mt-3 text-2xl font-semibold tracking-[-0.025em] sm:text-3xl"
                >
                  Equipo disponible en el Pro Shop
                </h2>
              </div>
              {!result.error ? (
                <p className="text-muted-foreground text-sm">
                  {result.data.length}{" "}
                  {result.data.length === 1 ? "opción" : "opciones"}
                </p>
              ) : null}
            </div>

            <div className="mt-10">
              {result.error ? (
                <section
                  role="alert"
                  className="bg-pg-warm-white rounded-[20px] px-6 py-14 sm:px-10 sm:py-16"
                >
                  <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
                    Hagamos una pausa
                  </p>
                  <h3 className="font-heading mt-4 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
                    No pudimos cargar el Pro Shop.
                  </h3>
                  <p className="text-muted-foreground mt-4 max-w-xl leading-7">
                    Intenta nuevamente en unos minutos. Tus opciones volverán a
                    mostrarse aquí cuando el catálogo esté disponible.
                  </p>
                </section>
              ) : result.data.length > 0 ? (
                <ProductGrid products={result.data} />
              ) : (
                <section className="bg-pg-warm-white rounded-[20px] px-6 py-14 sm:px-10 sm:py-16">
                  <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
                    Selección en preparación
                  </p>
                  <h3 className="font-heading mt-4 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
                    Estamos preparando nuevo equipo.
                  </h3>
                  <p className="text-muted-foreground mt-4 max-w-xl leading-7">
                    Aún no hay productos publicados. Vuelve pronto para conocer
                    las opciones elegidas para el Pro Shop.
                  </p>
                </section>
              )}
            </div>
          </section>

          <aside className="bg-pg-black-soft mt-20 grid gap-8 rounded-[20px] px-6 py-10 text-white sm:px-10 sm:py-12 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16">
            <div className="max-w-2xl">
              <p className="text-pg-gold text-xs font-semibold tracking-[0.2em] uppercase">
                Asesoría Peter Golf
              </p>
              <h2 className="font-heading mt-4 text-3xl leading-[1.05] font-bold tracking-[-0.035em] sm:text-4xl">
                ¿No estás seguro de cuál elegir?
              </h2>
              <p className="mt-5 text-sm leading-7 text-white/70 sm:text-base">
                Cuéntanos qué estás jugando y qué quieres mejorar. Te ayudaremos
                a comparar opciones con mayor claridad.
              </p>
            </div>
            <p className="border-pg-gold/40 text-pg-gold inline-flex min-h-11 w-fit items-center rounded-lg border px-4 text-xs font-semibold tracking-[0.14em] uppercase">
              Próximamente
            </p>
          </aside>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
