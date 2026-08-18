import Link from "next/link";

import { TaxonomyStatusBadge } from "@/components/operations/taxonomy-status-badge";
import { Button } from "@/components/ui/button";
import type {
  OperationalBrand,
  OperationalCategory,
} from "@/lib/catalog/operational-taxonomies";

export function BrandList({ brands }: { brands: OperationalBrand[] }) {
  return (
    <div className="overflow-hidden rounded-[20px] border bg-white">
      <ul className="divide-y">
        {brands.map((brand) => (
          <li
            key={brand.id}
            className="hover:bg-pg-warm-white/70 flex flex-col gap-4 p-5 transition-colors duration-200 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">{brand.name}</h2>
                <TaxonomyStatusBadge status={brand.status} />
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                /{brand.slug} · {brand.productCount} productos
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href={`/operacion/taxonomias/marcas/${brand.id}/editar`}>
                Editar
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CategoryList({
  categories,
}: {
  categories: OperationalCategory[];
}) {
  return (
    <div className="overflow-hidden rounded-[20px] border bg-white">
      <ul className="divide-y">
        {categories.map((category) => (
          <li
            key={category.id}
            className="hover:bg-pg-warm-white/70 flex flex-col gap-4 p-5 transition-colors duration-200 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">{category.displayName}</h2>
                <TaxonomyStatusBadge status={category.status} />
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                /{category.slug} · orden {category.sortOrder} ·{" "}
                {category.productCount} productos · {category.childCount} hijas
              </p>
            </div>
            <Button asChild variant="outline">
              <Link
                href={`/operacion/taxonomias/categorias/${category.id}/editar`}
              >
                Editar
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
