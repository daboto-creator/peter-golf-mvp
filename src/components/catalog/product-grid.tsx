import { ProductCard } from "@/components/catalog/product-card";
import type { PublicProductSummary } from "@/lib/catalog/public-products";

export function ProductGrid({
  products,
}: {
  products: PublicProductSummary[];
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
