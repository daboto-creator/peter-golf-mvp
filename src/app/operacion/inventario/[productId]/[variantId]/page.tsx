import { randomUUID } from "node:crypto";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import {
  InventoryAdjustmentForm,
  InventoryInitializer,
} from "@/components/operations/inventory-adjustment-form";
import { CatalogFeedback } from "@/components/operations/catalog-feedback";
import { ProductStatusBadge } from "@/components/operations/product-status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getConditionLabel } from "@/lib/catalog/presentation";
import { getOperationalInventoryDetail } from "@/lib/inventory/operational-inventory";
import { getInventoryLevelLabel } from "@/lib/inventory/inventory-rules";

export const metadata: Metadata = {
  title: "Detalle de inventario | Peter Golf",
};

export default async function InventoryVariantDetailPage({
  params,
}: {
  params: Promise<{ productId: string; variantId: string }>;
}) {
  const { productId, variantId } = await params;
  if (
    !z.uuid().safeParse(productId).success ||
    !z.uuid().safeParse(variantId).success
  )
    notFound();
  const result = await getOperationalInventoryDetail(productId, variantId);
  if (!result.error && !result.data) notFound();
  if (result.error || !result.data)
    return (
      <CatalogFeedback
        tone="error"
        title="No pudimos cargar el inventario"
        message="Inténtalo nuevamente. No se expusieron detalles internos del error."
      />
    );
  const item = result.data;

  return (
    <div className="space-y-8">
      <header>
        <Button asChild variant="ghost">
          <Link href="/operacion/inventario">← Volver al inventario</Link>
        </Button>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
              Detalle por variante
            </p>
            <h1 className="text-pg-black mt-3 text-4xl font-semibold tracking-[-0.035em]">
              {item.productName}
            </h1>
            <p className="text-muted-foreground mt-2">
              Producto: {item.productSku}
            </p>
            <p className="mt-2 font-medium">
              {item.variantName} · SKU {item.variantSku}
            </p>
          </div>
          <ProductStatusBadge status={item.status} published={item.published} />
        </div>
      </header>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Condición"
          value={getConditionLabel(item.condition, null)}
        />
        <Metric
          label="Existencia física"
          value={item.quantityOnHand ?? "—"}
          large
        />
        <Metric label="Disponible" value={item.available ?? "—"} large />
        <Metric label="Nivel" value={getInventoryLevelLabel(item.level)} />
      </div>
      {item.managementMessage ? (
        <CatalogFeedback tone="info" message={item.managementMessage} />
      ) : null}
      {item.manageable ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {item.inventoryId
                ? "Registrar movimiento"
                : "Inicializar inventario"}
            </CardTitle>
            <CardDescription>
              El movimiento afecta únicamente a {item.variantSku}; no modifica
              otras variantes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {item.inventoryId && item.quantityOnHand !== null ? (
              <InventoryAdjustmentForm
                productId={item.productId}
                variantId={item.variantId}
                quantityOnHand={item.quantityOnHand}
                initialIdempotencyKey={randomUUID()}
              />
            ) : (
              <InventoryInitializer
                productId={item.productId}
                variantId={item.variantId}
              />
            )}
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Historial reciente</CardTitle>
          <CardDescription>
            Últimos 50 movimientos de esta variante.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {item.movements.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              Todavía no hay movimientos registrados.
            </p>
          ) : (
            <ul className="divide-y">
              {item.movements.map((movement) => (
                <li
                  key={movement.id}
                  className="grid gap-3 py-4 md:grid-cols-[1fr_0.6fr_2fr]"
                >
                  <div>
                    <p className="font-medium">
                      {movement.movementType === "receipt"
                        ? "Recepción"
                        : "Ajuste"}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {new Intl.DateTimeFormat("es-MX", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(movement.createdAt))}
                    </p>
                  </div>
                  <div>
                    <p
                      className={
                        movement.quantityDelta > 0
                          ? "text-emerald-700"
                          : "text-red-700"
                      }
                    >
                      {movement.quantityDelta > 0 ? "+" : ""}
                      {movement.quantityDelta}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Saldo {movement.quantityOnHandAfter}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm">{movement.reason}</p>
                    {movement.reference ? (
                      <p className="text-muted-foreground mt-1 text-xs break-all">
                        {movement.reference}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
  label,
  value,
  large = false,
}: {
  label: string;
  value: string | number;
  large?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent
        className={large ? "text-3xl font-semibold" : "text-lg font-semibold"}
      >
        {value}
      </CardContent>
    </Card>
  );
}
