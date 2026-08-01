import { randomUUID } from "node:crypto";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import {
  InventoryAdjustmentForm,
  InventoryInitializer,
} from "@/components/operations/inventory-adjustment-form";
import { BaseVariantRepair } from "@/components/operations/base-variant-repair";
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

export default async function InventoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) notFound();

  const result = await getOperationalInventoryDetail(parsedId.data);
  if (!result.error && !result.data) notFound();

  if (result.error || !result.data) {
    return (
      <CatalogFeedback
        tone="error"
        title="No pudimos cargar el inventario"
        message="Inténtalo nuevamente. No se expusieron detalles internos del error."
      />
    );
  }

  const item = result.data;

  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="ghost">
          <Link href="/operacion/inventario">← Volver al inventario</Link>
        </Button>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium tracking-wide text-emerald-800 uppercase">
              Detalle de inventario
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {item.productName}
            </h1>
            <p className="text-muted-foreground mt-2">SKU {item.productSku}</p>
          </div>
          <ProductStatusBadge status={item.status} published={item.published} />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Condición</CardDescription>
          </CardHeader>
          <CardContent className="text-lg font-semibold">
            {getConditionLabel(item.condition, null)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Existencia física</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {item.quantityOnHand ?? "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Disponible</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {item.available ?? "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Nivel</CardDescription>
          </CardHeader>
          <CardContent className="text-lg font-semibold">
            {getInventoryLevelLabel(item.level)}
          </CardContent>
        </Card>
      </div>

      {item.managementMessage ? (
        <CatalogFeedback tone="info" message={item.managementMessage} />
      ) : null}

      {item.canRepairBaseVariant ? (
        <Card>
          <CardHeader>
            <CardTitle>Crear variante base</CardTitle>
            <CardDescription>
              Este producto proviene del flujo anterior. La reparación crea una
              única variante activa con el mismo SKU y nombre del producto; no
              inicializa ni modifica el inventario.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BaseVariantRepair productId={item.productId} />
          </CardContent>
        </Card>
      ) : null}

      {item.manageable && item.variantId ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {item.inventoryId
                ? "Registrar movimiento"
                : "Inicializar inventario"}
            </CardTitle>
            <CardDescription>
              El saldo nunca se edita directamente y un ajuste no cambia la
              publicación ni el estado comercial del producto.
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
            Últimos 50 movimientos, del más reciente al más antiguo.
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
