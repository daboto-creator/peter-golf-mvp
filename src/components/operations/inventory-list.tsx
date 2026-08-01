import Link from "next/link";

import { ProductStatusBadge } from "@/components/operations/product-status-badge";
import { Button } from "@/components/ui/button";
import { getConditionLabel } from "@/lib/catalog/presentation";
import {
  getInventoryLevelLabel,
  type InventoryLevel,
} from "@/lib/inventory/inventory-rules";
import type { OperationalInventorySummary } from "@/lib/inventory/operational-inventory";

const levelStyles: Record<InventoryLevel, string> = {
  uninitialized: "bg-zinc-100 text-zinc-700",
  out_of_stock: "bg-red-50 text-red-800",
  low_stock: "bg-amber-50 text-amber-800",
  in_stock: "bg-emerald-50 text-emerald-800",
};

export function InventoryList({
  items,
}: {
  items: OperationalInventorySummary[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      <div className="hidden grid-cols-[minmax(0,2fr)_1fr_0.8fr_0.9fr_1fr_auto] gap-4 border-b bg-zinc-50 px-5 py-3 text-xs font-medium tracking-wide text-zinc-600 uppercase lg:grid">
        <span>Producto</span>
        <span>Condición</span>
        <span>Estado</span>
        <span>Existencias</span>
        <span>Nivel / actualización</span>
        <span className="sr-only">Acción</span>
      </div>
      <ul className="divide-y">
        {items.map((item) => (
          <li
            key={item.productId}
            className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,2fr)_1fr_0.8fr_0.9fr_1fr_auto] lg:items-center"
          >
            <div className="min-w-0">
              <p className="font-medium">{item.productName}</p>
              <p className="text-muted-foreground mt-1 truncate text-sm">
                SKU {item.productSku}
              </p>
              {item.variantSku && item.variantSku !== item.productSku ? (
                <p className="text-muted-foreground mt-1 truncate text-xs">
                  Variante {item.variantSku}
                </p>
              ) : null}
            </div>
            <p className="text-sm">{getConditionLabel(item.condition, null)}</p>
            <ProductStatusBadge
              status={item.status}
              published={item.published}
            />
            <div className="text-sm">
              <p>
                Física: <strong>{item.quantityOnHand ?? "—"}</strong>
              </p>
              <p className="text-muted-foreground mt-1">
                Disponible: {item.available ?? "—"}
              </p>
            </div>
            <div>
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${levelStyles[item.level]}`}
              >
                {getInventoryLevelLabel(item.level)}
              </span>
              <p className="text-muted-foreground mt-2 text-xs">
                {new Intl.DateTimeFormat("es-MX", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(item.updatedAt))}
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href={`/operacion/inventario/${item.productId}`}>
                Ver detalle
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
