import Link from "next/link";

import { ProductAvailability } from "@/components/catalog/product-availability";
import { ProductImage } from "@/components/catalog/product-image";
import { ProductPrice } from "@/components/catalog/product-price";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getConditionLabel } from "@/lib/catalog/presentation";
import type { PublicProductSummary } from "@/lib/catalog/public-products";

export function ProductCard({ product }: { product: PublicProductSummary }) {
  const primaryImage = product.images[0] ?? null;

  return (
    <Card className="group h-full gap-4 overflow-hidden py-0 transition-shadow hover:shadow-md">
      <Link
        href={`/productos/${product.slug}`}
        className="focus-visible:ring-ring rounded-t-xl focus-visible:ring-2 focus-visible:outline-none"
      >
        <ProductImage
          storagePath={primaryImage?.storagePath ?? null}
          alt={primaryImage?.altText ?? product.name}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="rounded-b-none"
        />
      </Link>
      <CardHeader className="gap-2">
        <div className="text-muted-foreground flex flex-wrap gap-x-2 text-xs">
          <span>{product.brandName ?? "Marca no disponible"}</span>
          <span aria-hidden="true">·</span>
          <span>{product.categoryName ?? "Categoría no disponible"}</span>
        </div>
        <CardTitle className="text-lg leading-snug">
          <Link
            href={`/productos/${product.slug}`}
            className="rounded-sm underline-offset-4 group-hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            {product.name}
          </Link>
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          {getConditionLabel(product.condition, product.conditionGrade)}
        </p>
      </CardHeader>
      <CardContent className="mt-auto">
        <ProductPrice
          price={product.price}
          compareAtPrice={product.compareAtPrice}
          currency={product.currency}
          isEstimate={product.priceIsEstimate}
        />
      </CardContent>
      <CardFooter className="justify-between gap-3 pb-5">
        <ProductAvailability
          fulfillmentType={product.fulfillmentType}
          leadTimeMinDays={product.leadTimeMinDays}
          leadTimeMaxDays={product.leadTimeMaxDays}
        />
        <span className="text-sm font-medium">Ver detalle</span>
      </CardFooter>
    </Card>
  );
}
