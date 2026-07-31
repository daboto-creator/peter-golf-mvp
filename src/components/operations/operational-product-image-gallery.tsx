"use client";

import { useState, useTransition } from "react";

import { ProductImage } from "@/components/catalog/product-image";
import { CatalogFeedback } from "@/components/operations/catalog-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteProductImageAction,
  reorderProductImagesAction,
  updateProductImageAction,
  type ProductImageActionResult,
} from "@/lib/catalog/product-image-actions";
import type { OperationalProductImage } from "@/lib/catalog/operational-products";

export function OperationalProductImageGallery({
  productId,
  images,
  isUsed,
  disabled,
}: {
  productId: string;
  images: OperationalProductImage[];
  isUsed: boolean;
  disabled: boolean;
}) {
  const [result, setResult] = useState<ProductImageActionResult>({
    status: "idle",
  });
  const [pending, startTransition] = useTransition();

  function move(imageId: string, direction: -1 | 1) {
    const currentIndex = images.findIndex((image) => image.id === imageId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= images.length) {
      return;
    }

    const nextImages = [...images];
    [nextImages[currentIndex], nextImages[nextIndex]] = [
      nextImages[nextIndex],
      nextImages[currentIndex],
    ];
    startTransition(async () => {
      const nextResult = await reorderProductImagesAction(
        productId,
        nextImages.map((image) => image.id),
      );
      setResult(nextResult);
    });
  }

  return (
    <section className="space-y-5 rounded-xl border bg-white p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">Galería operativa</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          La primera imagen principal aparece en tarjetas y encabeza la galería
          pública. El orden desempata de forma determinista.
        </p>
      </div>

      {result.message ? (
        <CatalogFeedback
          tone={result.status === "success" ? "success" : "error"}
          message={result.message}
        />
      ) : null}

      {images.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">
            Este producto todavía no tiene imágenes.
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            El catálogo público mantendrá su fallback visual.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {images.map((image, index) => (
            <OperationalImageEditor
              key={`${image.id}:${image.altText}:${image.isConditionEvidence}`}
              productId={productId}
              image={image}
              index={index}
              imageCount={images.length}
              isUsed={isUsed}
              disabled={disabled || pending}
              onMove={move}
              onResult={setResult}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function OperationalImageEditor({
  productId,
  image,
  index,
  imageCount,
  isUsed,
  disabled,
  onMove,
  onResult,
}: {
  productId: string;
  image: OperationalProductImage;
  index: number;
  imageCount: number;
  isUsed: boolean;
  disabled: boolean;
  onMove: (imageId: string, direction: -1 | 1) => void;
  onResult: (result: ProductImageActionResult) => void;
}) {
  const [altText, setAltText] = useState(image.altText);
  const [isConditionEvidence, setIsConditionEvidence] = useState(
    image.isConditionEvidence,
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  function update(makePrimary: boolean) {
    startTransition(async () => {
      const result = await updateProductImageAction(productId, image.id, {
        altText,
        isPrimary: makePrimary || image.isPrimary,
        isConditionEvidence,
      });
      onResult(result);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteProductImageAction(productId, image.id);
      onResult(result);
      if (result.status === "success") {
        setConfirmingDelete(false);
      }
    });
  }

  return (
    <article className="space-y-4 rounded-xl border p-4">
      <ProductImage
        storagePath={image.storagePath}
        alt={image.altText}
        sizes="(max-width: 1024px) 100vw, 50vw"
      />
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
        {image.isPrimary ? (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-900">
            Principal
          </span>
        ) : null}
        {image.isConditionEvidence ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-950">
            Evidencia de condición
          </span>
        ) : null}
        <span className="text-muted-foreground">Posición {index + 1}</span>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`alt-${image.id}`}>Texto alternativo</Label>
        <Input
          id={`alt-${image.id}`}
          value={altText}
          maxLength={300}
          disabled={disabled || pending}
          onChange={(event) => setAltText(event.target.value)}
        />
      </div>
      {isUsed ? (
        <label className="flex items-center gap-3 rounded-lg border p-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={isConditionEvidence}
            disabled={disabled || pending}
            onChange={(event) => setIsConditionEvidence(event.target.checked)}
            className="border-input size-4 rounded"
          />
          Evidencia de condición
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={disabled || pending}
          onClick={() => update(false)}
        >
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        {!image.isPrimary ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || pending}
            onClick={() => update(true)}
          >
            Hacer principal
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || pending || index === 0}
          onClick={() => onMove(image.id, -1)}
          aria-label="Mover imagen hacia arriba"
        >
          ↑
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || pending || index === imageCount - 1}
          onClick={() => onMove(image.id, 1)}
          aria-label="Mover imagen hacia abajo"
        >
          ↓
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={disabled || pending}
          onClick={() => setConfirmingDelete(true)}
        >
          Eliminar
        </Button>
      </div>
      {confirmingDelete ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="font-medium text-red-950">
            ¿Eliminar esta imagen y su archivo?
          </p>
          <p className="mt-1 text-sm text-red-900">
            Esta acción no elimina el producto.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={remove}
            >
              {pending ? "Eliminando…" : "Sí, eliminar"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirmingDelete(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
