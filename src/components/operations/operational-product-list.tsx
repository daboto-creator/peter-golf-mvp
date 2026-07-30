import Link from "next/link";

import { ProductStatusBadge } from "@/components/operations/product-status-badge";
import { Button } from "@/components/ui/button";
import {
  formatMoneyMinorUnits,
  getConditionLabel,
} from "@/lib/catalog/presentation";
import type { OperationalProductSummary } from "@/lib/catalog/operational-products";

export function OperationalProductList({
  products,
}: {
  products: OperationalProductSummary[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      <div className="hidden grid-cols-[minmax(0,2fr)_1fr_1fr_0.8fr_auto] gap-4 border-b bg-zinc-50 px-5 py-3 text-xs font-medium tracking-wide text-zinc-600 uppercase lg:grid">
        <span>Producto</span>
        <span>Clasificación</span>
        <span>Precio</span>
        <span>Estado</span>
        <span className="sr-only">Acciones</span>
      </div>
      <ul className="divide-y">
        {products.map((product) => (
          <li
            key={product.id}
            className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,2fr)_1fr_1fr_0.8fr_auto] lg:items-center"
          >
            <div className="min-w-0">
              <p className="font-medium">{product.name}</p>
              <p className="text-muted-foreground mt-1 truncate text-sm">
                SKU {product.sku}
              </p>
              <p className="text-muted-foreground mt-1 text-sm lg:hidden">
                {product.brandName ?? "Sin marca"} ·{" "}
                {product.categoryName ?? "Sin categoría"}
              </p>
            </div>
            <div className="hidden text-sm lg:block">
              <p>{product.brandName ?? "Sin marca"}</p>
              <p className="text-muted-foreground mt-1">
                {product.categoryName ?? "Sin categoría"}
              </p>
              <p className="text-muted-foreground mt-1">
                {getConditionLabel(product.condition, product.conditionGrade)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">
                {formatMoneyMinorUnits(product.price, product.currency)}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {product.fulfillmentType === "in_stock"
                  ? "En stock"
                  : product.fulfillmentType === "special_order"
                    ? "Sobre pedido"
                    : "Preventa"}
              </p>
            </div>
            <div>
              <ProductStatusBadge
                status={product.status}
                published={product.published}
              />
              <p className="text-muted-foreground mt-2 text-xs">
                {product.status === "archived"
                  ? "Fuera de operación"
                  : product.status === "active"
                    ? "Activo"
                    : "En preparación"}
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href={`/operacion/catalogo/${product.id}/editar`}>
                Editar
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
