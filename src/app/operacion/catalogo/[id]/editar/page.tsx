import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { CatalogFeedback } from "@/components/operations/catalog-feedback";
import { OperationalProductImageGallery } from "@/components/operations/operational-product-image-gallery";
import { ProductForm } from "@/components/operations/product-form";
import { ProductImageUploader } from "@/components/operations/product-image-uploader";
import { ProductStateActions } from "@/components/operations/product-state-actions";
import { ProductStatusBadge } from "@/components/operations/product-status-badge";
import { Button } from "@/components/ui/button";
import {
  getOperationalProductById,
  listActiveCatalogReferences,
  listOperationalProductImages,
  productToFormValues,
} from "@/lib/catalog/operational-products";

type EditProductPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creado?: string | string[] }>;
};

export const metadata: Metadata = {
  title: "Editar producto | Peter Golf",
};

export default async function EditProductPage({
  params,
  searchParams,
}: EditProductPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const [productResult, references, imagesResult] = await Promise.all([
    getOperationalProductById(id),
    listActiveCatalogReferences(),
    listOperationalProductImages(id),
  ]);

  if (!productResult.error && !productResult.data) {
    notFound();
  }

  if (productResult.error || !productResult.data) {
    return (
      <CatalogFeedback
        tone="error"
        title="No pudimos cargar el producto"
        message="Inténtalo nuevamente desde el catálogo operativo."
      />
    );
  }

  const product = productResult.data;

  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="ghost" className="-ml-2">
          <Link href="/operacion/catalogo">← Volver al catálogo</Link>
        </Button>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            Editar producto
          </h1>
          <ProductStatusBadge
            status={product.status}
            published={product.published}
          />
        </div>
        <p className="text-muted-foreground mt-3">
          {product.name} · SKU {product.sku}
        </p>
      </div>

      {query.creado === "1" ? (
        <CatalogFeedback
          tone="success"
          message="El producto se creó correctamente."
        />
      ) : null}

      {references.error ? (
        <CatalogFeedback
          tone="error"
          title="No pudimos cargar marcas y categorías"
          message="La edición está deshabilitada temporalmente."
        />
      ) : null}

      <ProductStateActions
        productId={product.id}
        status={product.status}
        published={product.published}
      />

      <ProductForm
        mode="edit"
        productId={product.id}
        defaultValues={productToFormValues(product)}
        brands={references.data?.brands ?? []}
        categories={references.data?.categories ?? []}
        disabled={product.status === "archived" || Boolean(references.error)}
      />

      {imagesResult.error ? (
        <CatalogFeedback
          tone="error"
          title="No pudimos cargar las imágenes"
          message="La gestión de imágenes está deshabilitada temporalmente."
        />
      ) : (
        <>
          <ProductImageUploader
            productId={product.id}
            isUsed={product.condition === "used"}
            disabled={product.status === "archived"}
          />
          <OperationalProductImageGallery
            productId={product.id}
            images={imagesResult.data}
            isUsed={product.condition === "used"}
            disabled={product.status === "archived"}
          />
        </>
      )}
    </div>
  );
}
