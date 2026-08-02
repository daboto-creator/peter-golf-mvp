import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { BaseVariantRepair } from "@/components/operations/base-variant-repair";
import { CatalogFeedback } from "@/components/operations/catalog-feedback";
import { InventoryList } from "@/components/operations/inventory-list";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getOperationalInventoryProductOverview } from "@/lib/inventory/operational-inventory";

export const metadata: Metadata = {
  title: "Variantes de inventario | Peter Golf",
};

export default async function InventoryProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  if (!z.uuid().safeParse(productId).success) notFound();
  const result = await getOperationalInventoryProductOverview(productId);
  if (!result.error && !result.data) notFound();
  if (result.error || !result.data) {
    return (
      <CatalogFeedback
        tone="error"
        title="No pudimos cargar el inventario"
        message="Inténtalo nuevamente."
      />
    );
  }
  const product = result.data;
  if (product.variants.length === 1) {
    redirect(
      `/operacion/inventario/${product.productId}/${product.variants[0]!.variantId}`,
    );
  }
  return (
    <div className="space-y-8">
      <header>
        <Button asChild variant="ghost">
          <Link href="/operacion/inventario">← Volver al inventario</Link>
        </Button>
        <h1 className="mt-4 text-3xl font-semibold">{product.productName}</h1>
        <p className="text-muted-foreground mt-2">SKU {product.productSku}</p>
      </header>
      {product.variants.length > 1 ? (
        <>
          <p className="text-muted-foreground">
            Selecciona la variante cuyo inventario deseas consultar o ajustar.
          </p>
          <InventoryList items={product.variants} />
        </>
      ) : null}
      {product.canRepairBaseVariant ? (
        <Card>
          <CardHeader>
            <CardTitle>Crear variante base</CardTitle>
            <CardDescription>
              Este producto no tiene variantes. La reparación crea una variante
              base sin inicializar inventario.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BaseVariantRepair productId={product.productId} />
          </CardContent>
        </Card>
      ) : null}
      {product.variants.length === 0 && !product.canRepairBaseVariant ? (
        <CatalogFeedback
          tone="info"
          message="Este producto no tiene variantes operativas ajustables."
        />
      ) : null}
    </div>
  );
}
