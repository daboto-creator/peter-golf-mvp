import type { Metadata } from "next";
import Link from "next/link";

import { CatalogFeedback } from "@/components/operations/catalog-feedback";
import { InventoryList } from "@/components/operations/inventory-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listOperationalInventory } from "@/lib/inventory/operational-inventory";
import type { InventoryLevel } from "@/lib/inventory/inventory-rules";
import type { Database } from "@/types/database.types";

export const metadata: Metadata = {
  title: "Inventario operativo | Best Round Pro Shop",
};

type ProductStatus = Database["public"]["Enums"]["product_status"];
type ProductCondition = Database["public"]["Enums"]["product_condition"];

type InventorySearchParams = {
  q?: string;
  status?: string;
  condition?: string;
  stock?: string;
};

const statuses: ProductStatus[] = ["draft", "active", "archived"];
const conditions: ProductCondition[] = ["new", "used"];
const levels: InventoryLevel[] = [
  "uninitialized",
  "out_of_stock",
  "low_stock",
  "in_stock",
];

export default async function OperationalInventoryPage({
  searchParams,
}: {
  searchParams: Promise<InventorySearchParams>;
}) {
  const filters = await searchParams;
  const status = statuses.find((value) => value === filters.status);
  const condition = conditions.find((value) => value === filters.condition);
  const level = levels.find((value) => value === filters.stock);
  const result = await listOperationalInventory({
    query: filters.q,
    status,
    condition,
  });
  const items = result.data?.filter((item) => !level || item.level === level);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
          Control auditable
        </p>
        <h1 className="text-pg-black mt-3 text-4xl font-semibold tracking-[-0.035em]">
          Inventario
        </h1>
        <p className="text-muted-foreground mt-3 max-w-3xl leading-7">
          Consulta saldo físico y disponible. Todo cambio se registra como un
          movimiento inmutable; esta vista carga como máximo 200 variantes.
        </p>
      </div>

      <form className="grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="q">Producto o variante</Label>
          <Input
            id="q"
            name="q"
            defaultValue={filters.q}
            placeholder="Nombre o SKU de producto o variante"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Estado</Label>
          <select
            id="status"
            name="status"
            defaultValue={status ?? ""}
            className="border-input bg-background focus-visible:ring-pg-gold h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
          >
            <option value="">Todos</option>
            <option value="draft">Borrador</option>
            <option value="active">Activo</option>
            <option value="archived">Archivado</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="condition">Condición</Label>
          <select
            id="condition"
            name="condition"
            defaultValue={condition ?? ""}
            className="border-input bg-background focus-visible:ring-pg-gold h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
          >
            <option value="">Todas</option>
            <option value="new">Nuevo</option>
            <option value="used">Seminuevo</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="stock">Nivel</Label>
          <select
            id="stock"
            name="stock"
            defaultValue={level ?? ""}
            className="border-input bg-background focus-visible:ring-pg-gold h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
          >
            <option value="">Todos</option>
            <option value="uninitialized">Sin inicializar</option>
            <option value="out_of_stock">Agotado</option>
            <option value="low_stock">Stock bajo</option>
            <option value="in_stock">En stock</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2 lg:col-span-5">
          <Button type="submit">Aplicar filtros</Button>
          <Button asChild variant="outline">
            <Link href="/operacion/inventario">Limpiar</Link>
          </Button>
        </div>
      </form>

      {result.error ? (
        <CatalogFeedback
          tone="error"
          title="No pudimos cargar el inventario"
          message="Inténtalo nuevamente. No se expusieron detalles internos del error."
        />
      ) : items?.length === 0 ? (
        <section className="rounded-xl border border-dashed bg-white px-6 py-14 text-center">
          <h2 className="text-xl font-semibold">No hay resultados</h2>
          <p className="text-muted-foreground mx-auto mt-3 max-w-lg">
            Ajusta los filtros o crea primero el producto y su variante dentro
            del modelo existente.
          </p>
        </section>
      ) : (
        <InventoryList items={items ?? []} />
      )}
    </div>
  );
}
