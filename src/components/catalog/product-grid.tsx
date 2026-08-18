import { ProductCard } from "@/components/catalog/product-card";
import type { PublicProductSummary } from "@/lib/catalog/public-products";

export function ProductGrid({
  products,
}: {
  products: PublicProductSummary[];
}) {
  return (
    <ul className="grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-16">
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
