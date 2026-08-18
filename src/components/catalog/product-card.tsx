import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { ProductAvailability } from "@/components/catalog/product-availability";
import { ProductImage } from "@/components/catalog/product-image";
import { ProductPrice } from "@/components/catalog/product-price";
import { getConditionLabel } from "@/lib/catalog/presentation";
import type { PublicProductSummary } from "@/lib/catalog/public-products";

export function ProductCard({ product }: { product: PublicProductSummary }) {
  const primaryImage = product.images[0] ?? null;

  return (
    <article data-product-card className="group flex h-full flex-col">
      <Link
        href={`/productos/${product.slug}`}
        className="rounded-[20px] focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none"
      >
        <ProductImage
          storagePath={primaryImage?.storagePath ?? null}
          alt={primaryImage?.altText ?? product.name}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="group-hover:border-pg-gold/45 aspect-[5/4] rounded-[20px] border border-transparent transition-colors duration-200"
        />
      </Link>
      <div className="flex flex-1 flex-col pt-5">
        <div className="text-muted-foreground flex flex-wrap gap-x-2 text-xs leading-5">
          <span>{product.brandName ?? "Marca no disponible"}</span>
          <span aria-hidden="true">·</span>
          <span>{product.categoryName ?? "Categoría no disponible"}</span>
        </div>
        <h3 className="mt-2 text-lg leading-snug font-semibold tracking-[-0.015em]">
          <Link
            href={`/productos/${product.slug}`}
            className="group-hover:text-pg-gold rounded-sm transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none"
          >
            {product.name}
          </Link>
        </h3>
        <p className="text-muted-foreground mt-2 text-sm">
          {getConditionLabel(product.condition, product.conditionGrade)}
        </p>

        <ProductPrice
          price={product.price}
          compareAtPrice={product.compareAtPrice}
          currency={product.currency}
          isEstimate={product.priceIsEstimate}
          className="mt-5"
        />

        <div className="mt-auto flex items-center justify-between gap-3 border-t pt-5">
          <ProductAvailability
            fulfillmentType={product.fulfillmentType}
            leadTimeMinDays={product.leadTimeMinDays}
            leadTimeMaxDays={product.leadTimeMaxDays}
          />
          <Link
            href={`/productos/${product.slug}`}
            className="hover:text-pg-gold inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-semibold transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none"
          >
            Ver detalle
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}
