"use client";

import { useRef, useState, useTransition } from "react";

import { CatalogFeedback } from "@/components/operations/catalog-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProductImageActionResult } from "@/lib/catalog/catalog-action-state";
import {
  MAX_PRODUCT_IMAGES_PER_UPLOAD,
  MAX_PRODUCT_IMAGE_BYTES,
} from "@/lib/catalog/product-image-rules";
import { uploadProductImagesAction } from "@/lib/catalog/product-image-actions";

export function ProductImageUploader({
  productId,
  isUsed,
  disabled,
}: {
  productId: string;
  isUsed: boolean;
  disabled: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ProductImageActionResult>({
    status: "idle",
  });

  function submit(formData: FormData) {
    startTransition(async () => {
      const nextResult = await uploadProductImagesAction(productId, formData);
      setResult(nextResult);
      if (nextResult.status === "success") {
        formRef.current?.reset();
      }
    });
  }

  return (
    <section className="space-y-5 rounded-xl border bg-white p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">Subir imágenes</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Hasta {MAX_PRODUCT_IMAGES_PER_UPLOAD} archivos JPEG, PNG o WebP por
          operación, con máximo {MAX_PRODUCT_IMAGE_BYTES / 1024 / 1024} MiB cada
          uno. No se acepta SVG.
        </p>
      </div>

      {result.message ? (
        <CatalogFeedback
          tone={result.status === "success" ? "success" : "error"}
          message={result.message}
        />
      ) : null}

      <form ref={formRef} action={submit} className="space-y-4">
        <fieldset disabled={disabled || pending} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product-images">Archivos</Label>
            <Input
              id="product-images"
              name="images"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-images-alt">Texto alternativo</Label>
            <Input
              id="product-images-alt"
              name="altText"
              maxLength={300}
              required
              placeholder="Ej. Vista frontal del putter sobre fondo neutro"
            />
            <p className="text-muted-foreground text-xs">
              Se aplicará a los archivos de esta operación y podrás editarlo
              individualmente después.
            </p>
          </div>
          {isUsed ? (
            <label className="flex items-center gap-3 rounded-lg border p-3 text-sm font-medium">
              <input
                name="isConditionEvidence"
                type="checkbox"
                className="border-input size-4 rounded"
              />
              Marcar como evidencia de condición
            </label>
          ) : null}
          <Button type="submit" disabled={disabled || pending}>
            {pending ? "Subiendo…" : "Subir imágenes"}
          </Button>
        </fieldset>
      </form>
    </section>
  );
}
