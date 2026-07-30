import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductAvailability } from "@/components/catalog/product-availability";
import { ProductImage } from "@/components/catalog/product-image";
import { ProductPrice } from "@/components/catalog/product-price";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
      title: "Producto | Peter Golf",
      description: "Consulta productos de golf nuevos y seminuevos.",
      robots: result.error ? undefined : { index: false, follow: false },
    };
  }

  return {
    title: `${result.data.seoTitle ?? result.data.name} | Peter Golf`,
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
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-16">
        <Alert>
          <AlertTitle>No pudimos cargar este producto</AlertTitle>
          <AlertDescription>
            Intenta nuevamente en unos minutos o vuelve al{" "}
            <Link href="/productos" className="font-medium underline">
              catálogo
            </Link>
            .
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  if (!result.data) {
    notFound();
  }

  const product = result.data;
  const images = product.images.length > 0 ? product.images : [null];

  return (
    <main className="min-h-screen bg-white">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="rounded-sm text-lg font-semibold focus-visible:ring-2 focus-visible:outline-none"
          >
            Peter Golf
          </Link>
          <Link
            href="/productos"
            className="rounded-sm text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            Volver a productos
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
          <section aria-label="Imágenes del producto">
            <div className="grid gap-4 sm:grid-cols-2">
              {images.map((image, index) => (
                <ProductImage
                  key={image?.id ?? "fallback"}
                  storagePath={image?.storagePath ?? null}
                  alt={image?.altText ?? product.name}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className={index === 0 ? "sm:col-span-2" : undefined}
                />
              ))}
            </div>
          </section>

          <article>
            <div className="text-muted-foreground mb-3 flex flex-wrap gap-x-2 text-sm">
              <span>{product.brandName ?? "Marca no disponible"}</span>
              <span aria-hidden="true">·</span>
              <span>{product.categoryName ?? "Categoría no disponible"}</span>
            </div>
            <h1 className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
              {product.name}
            </h1>
            <p className="mt-3 font-medium text-emerald-800">
              {getConditionLabel(product.condition, product.conditionGrade)}
            </p>

            <ProductPrice
              price={product.price}
              compareAtPrice={product.compareAtPrice}
              currency={product.currency}
              isEstimate={product.priceIsEstimate}
              className="mt-7 border-y py-5"
            />

            <div className="mt-6">
              <ProductAvailability
                fulfillmentType={product.fulfillmentType}
                leadTimeMinDays={product.leadTimeMinDays}
                leadTimeMaxDays={product.leadTimeMaxDays}
                showDetail
              />
            </div>

            <div className="mt-8 space-y-4">
              <h2 className="text-lg font-semibold">Descripción</h2>
              <p className="text-muted-foreground leading-7 whitespace-pre-line">
                {product.description ??
                  product.shortDescription ??
                  "La descripción detallada estará disponible pronto."}
              </p>
            </div>

            {product.conditionNotes ? (
              <div className="mt-8 rounded-xl border bg-amber-50/60 p-5">
                <h2 className="font-semibold">Condición del artículo</h2>
                <p className="mt-2 text-sm leading-6 text-amber-950">
                  {product.conditionNotes}
                </p>
              </div>
            ) : null}
          </article>
        </div>

        {product.variants.length > 0 ? (
          <section
            className="mt-14 border-t pt-10"
            aria-labelledby="variants-title"
          >
            <h2 id="variants-title" className="text-2xl font-semibold">
              Variantes disponibles
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {product.variants.map((variant) => (
                <div key={variant.id} className="rounded-xl border p-5">
                  <h3 className="font-medium">{variant.name}</h3>
                  <ProductPrice
                    price={variant.price ?? product.price}
                    compareAtPrice={
                      variant.compareAtPrice ?? product.compareAtPrice
                    }
                    currency={product.currency}
                    isEstimate={product.priceIsEstimate}
                    className="mt-3"
                  />
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
