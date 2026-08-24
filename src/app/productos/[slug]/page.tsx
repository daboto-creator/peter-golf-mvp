import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { BadgeCheck, ChevronRight, ShieldCheck, Truck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductAvailability } from "@/components/catalog/product-availability";
import { ProductImage } from "@/components/catalog/product-image";
import { ProductPrice } from "@/components/catalog/product-price";
import { ProductSpecifications } from "@/components/catalog/product-specifications";
import { AddToCartForm } from "@/components/cart/add-to-cart-form";
import { PublicFooter } from "@/components/catalog/public-footer";
import { PublicHeader } from "@/components/catalog/public-header";
import { getConditionLabel } from "@/lib/catalog/presentation";
import { getPublicProductBySlug } from "@/lib/catalog/public-products";

type ProductDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublicProductBySlug(slug);

  if (result.error || !result.data) {
    return {
      title: "Producto | Best Round Pro Shop",
      description: "Consulta productos de golf nuevos y seminuevos.",
      robots: result.error ? undefined : { index: false, follow: false },
    };
  }

  return {
    title: `${result.data.seoTitle ?? result.data.name} | Best Round Pro Shop`,
    description:
      result.data.seoDescription ??
      result.data.shortDescription ??
      "Equipo de golf con condición, precio y disponibilidad claramente indicados.",
  };
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { slug } = await params;
  const result = await getPublicProductBySlug(slug);

  if (!result.error && !result.data) {
    notFound();
  }

  if (result.error) {
    return (
      <div className="bg-pg-warm-white min-h-screen">
        <PublicHeader />
        <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center px-4 py-20 sm:px-6">
          <section className="border-border w-full border-y py-12 text-center">
            <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
              Pro Shop
            </p>
            <h1 className="font-heading text-pg-black mt-4 text-3xl font-bold sm:text-4xl">
              No pudimos cargar este producto
            </h1>
            <p className="text-muted-foreground mx-auto mt-4 max-w-xl leading-7">
              Intenta nuevamente en unos minutos o vuelve al Pro Shop para
              seguir explorando equipo.
            </p>
            <Link
              href="/productos"
              className="bg-pg-black focus-visible:ring-pg-gold hover:bg-pg-black-soft mt-7 inline-flex min-h-11 items-center rounded-xl px-6 text-sm font-semibold text-white transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Volver al Pro Shop
            </Link>
          </section>
        </main>
        <PublicFooter />
      </div>
    );
  }

  if (!result.data) {
    notFound();
  }

  const product = result.data;
  const images = product.images.length > 0 ? product.images : [null];

  return (
    <div className="bg-pg-white min-h-screen">
      <PublicHeader />

      <main>
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8">
          <nav aria-label="Ruta del producto">
            <ol className="text-muted-foreground flex min-w-0 items-center gap-2 text-xs sm:text-sm">
              <li>
                <Link
                  href="/productos"
                  className="focus-visible:ring-pg-gold hover:text-pg-black inline-flex min-h-11 items-center rounded-lg transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none"
                >
                  Pro Shop
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="size-4" strokeWidth={1.5} />
              </li>
              {product.categoryName ? (
                <>
                  <li className="hidden truncate sm:block">
                    {product.categoryName}
                  </li>
                  <li aria-hidden="true" className="hidden sm:block">
                    <ChevronRight className="size-4" strokeWidth={1.5} />
                  </li>
                </>
              ) : null}
              <li className="text-pg-charcoal truncate" aria-current="page">
                {product.name}
              </li>
            </ol>
          </nav>
        </div>

        <div className="mx-auto max-w-7xl px-4 pt-5 pb-16 sm:px-6 sm:pt-7 sm:pb-20 lg:px-8 lg:pb-24">
          <div className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16 xl:gap-20">
            <section aria-label="Imágenes del producto">
              <ProductImage
                storagePath={images[0]?.storagePath ?? null}
                alt={images[0]?.altText ?? product.name}
                sizes="(max-width: 1023px) calc(100vw - 2rem), 52vw"
                className="aspect-square rounded-[20px]"
              />

              {images.length > 1 ? (
                <div className="mt-4 grid grid-cols-2 gap-4">
                  {images.slice(1).map((image) => (
                    <ProductImage
                      key={image?.id ?? "fallback"}
                      storagePath={image?.storagePath ?? null}
                      alt={image?.altText ?? product.name}
                      sizes="(max-width: 640px) 50vw, (max-width: 1023px) 45vw, 26vw"
                      className="rounded-xl"
                    />
                  ))}
                </div>
              ) : null}
            </section>

            <article data-product-detail className="lg:pt-3">
              <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs font-medium tracking-[0.08em] uppercase">
                <span>{product.brandName ?? "Marca no disponible"}</span>
                <span className="text-pg-gold" aria-hidden="true">
                  /
                </span>
                <span>{product.categoryName ?? "Categoría no disponible"}</span>
              </div>
              <h1 className="font-heading text-pg-black mt-4 text-4xl leading-[1.08] font-bold tracking-[-0.025em] sm:text-5xl lg:text-[3.35rem]">
                {product.name}
              </h1>
              <div className="mt-5 flex items-center gap-3">
                <span className="bg-pg-gold h-px w-8" aria-hidden="true" />
                <p className="text-pg-charcoal text-sm font-semibold tracking-wide">
                  {getConditionLabel(
                    product.condition,
                    product.conditionGrade,
                    product.conditionScore,
                  )}
                </p>
              </div>

              {product.shortDescription ? (
                <p className="text-muted-foreground mt-6 max-w-xl leading-7">
                  {product.shortDescription}
                </p>
              ) : null}

              <ProductPrice
                price={product.price}
                compareAtPrice={product.compareAtPrice}
                currency={product.currency}
                isEstimate={product.priceIsEstimate}
                className="border-border mt-7 border-y py-6 [&>span:first-child]:text-3xl [&>span:first-child]:tracking-tight"
              />

              <div className="mt-6">
                <ProductAvailability
                  fulfillmentType={product.fulfillmentType}
                  leadTimeMinDays={product.leadTimeMinDays}
                  leadTimeMaxDays={product.leadTimeMaxDays}
                  showDetail
                />
              </div>

              <AddToCartForm
                productId={product.id}
                slug={product.slug}
                variants={product.variants.map(({ id, name, sku }) => ({
                  id,
                  name,
                  sku,
                }))}
                idempotencyKey={randomUUID()}
              />

              <section
                aria-labelledby="purchase-confidence-title"
                className="border-border mt-7 border-t pt-6"
              >
                <h2 id="purchase-confidence-title" className="sr-only">
                  Compra con confianza
                </h2>
                <ul className="grid gap-4 text-sm sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  <li className="flex items-start gap-3">
                    <ShieldCheck
                      className="text-pg-gold mt-0.5 size-5 shrink-0"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                    <span>Compra segura</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Truck
                      className="text-pg-gold mt-0.5 size-5 shrink-0"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                    <span>Envíos a todo México</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <BadgeCheck
                      className="text-pg-gold mt-0.5 size-5 shrink-0"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                    <span>Condición transparente</span>
                  </li>
                </ul>
              </section>
            </article>
          </div>

          <section
            className="border-border mt-16 grid gap-8 border-t pt-12 md:grid-cols-[0.42fr_0.58fr] md:gap-16 lg:mt-24 lg:pt-16"
            aria-labelledby="description-title"
          >
            <div>
              <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
                Acerca del producto
              </p>
              <h2
                id="description-title"
                className="font-heading text-pg-black mt-3 text-3xl font-bold sm:text-4xl"
              >
                Detalles para decidir con claridad.
              </h2>
            </div>
            <div>
              <p className="text-muted-foreground leading-8 whitespace-pre-line">
                {product.description ??
                  product.shortDescription ??
                  "La descripción detallada estará disponible pronto."}
              </p>

              {product.conditionNotes ? (
                <div className="bg-pg-warm-white border-pg-gold/45 mt-8 rounded-xl border-l-2 p-5 sm:p-6">
                  <h3 className="text-pg-black font-semibold">
                    Condición del artículo
                  </h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-7">
                    {product.conditionNotes}
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <ProductSpecifications product={product} />

          {product.variants.length > 0 ? (
            <section
              className="border-border mt-16 border-t pt-12 lg:mt-20"
              aria-labelledby="variants-title"
            >
              <div className="max-w-2xl">
                <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
                  Configuraciones reales
                </p>
                <h2
                  id="variants-title"
                  className="font-heading text-pg-black mt-3 text-3xl font-bold sm:text-4xl"
                >
                  Variantes disponibles
                </h2>
              </div>
              <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {product.variants.map((variant) => (
                  <div
                    key={variant.id}
                    className="border-border hover:border-pg-charcoal/40 rounded-xl border bg-white p-5 transition-colors duration-200 sm:p-6"
                  >
                    <h3 className="text-pg-black font-medium">
                      {variant.name}
                    </h3>
                    <ProductPrice
                      price={variant.price ?? product.price}
                      compareAtPrice={
                        variant.compareAtPrice ?? product.compareAtPrice
                      }
                      currency={product.currency}
                      isEstimate={product.priceIsEstimate}
                      className="mt-4"
                    />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <aside
            className="bg-pg-black mt-16 overflow-hidden rounded-[20px] text-white lg:mt-24"
            aria-labelledby="advice-title"
          >
            <div className="grid md:grid-cols-[0.9fr_1.1fr]">
              <div className="flex flex-col justify-center px-6 py-10 sm:px-10 sm:py-12 lg:px-14">
                <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
                  Golf Concierge
                </p>
                <h2
                  id="advice-title"
                  className="font-heading mt-4 text-3xl leading-tight font-bold sm:text-4xl"
                >
                  ¿No estás seguro de que este sea el equipo correcto para ti?
                </h2>
                <p className="mt-5 max-w-xl text-sm leading-7 text-white/70 sm:text-base">
                  Cuéntanos qué juegas, qué quieres mejorar y qué estás
                  buscando. Te ayudamos a comparar opciones.
                </p>
                <p className="border-pg-gold/50 mt-7 w-fit border-b pb-1 text-xs font-semibold tracking-[0.14em] text-white/85 uppercase">
                  Asesoría personalizada · Próximamente
                </p>
              </div>
              <figure className="relative min-h-64 overflow-hidden md:min-h-[420px]">
                <Image
                  src="/images/home/advice-fitting-temporary.jpg"
                  alt="Golfista recibiendo asesoría mientras revisa equipo de golf"
                  fill
                  sizes="(max-width: 767px) calc(100vw - 2rem), 55vw"
                  className="object-cover object-center"
                />
                <figcaption className="absolute right-4 bottom-4 rounded-lg bg-black/65 px-3 py-2 text-[0.65rem] tracking-[0.12em] text-white/80 uppercase backdrop-blur-sm">
                  Imagen editorial
                </figcaption>
              </figure>
            </div>
          </aside>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
