"use client";

import { useState, useTransition } from "react";

import { CatalogFeedback } from "@/components/operations/catalog-feedback";
import { Button } from "@/components/ui/button";
import {
  archiveProductAction,
  publishProductAction,
  restoreProductAction,
  unpublishProductAction,
  type CatalogActionResult,
} from "@/lib/catalog/operational-actions";
import type { Database } from "@/types/database.types";

type ProductStatus = Database["public"]["Enums"]["product_status"];

export function ProductStateActions({
  productId,
  status,
  published,
}: {
  productId: string;
  status: ProductStatus;
  published: boolean;
}) {
  const [result, setResult] = useState<CatalogActionResult>({
    status: "idle",
  });
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(action: (id: string) => Promise<CatalogActionResult>) {
    startTransition(async () => {
      const nextResult = await action(productId);
      setResult(nextResult);
      if (nextResult.status === "success") {
        setConfirmingArchive(false);
      }
    });
  }

  return (
    <section className="space-y-4 rounded-xl border bg-white p-5">
      <div>
        <h2 className="font-semibold">Estado del producto</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Publicar controla la visibilidad pública. Archivar conserva el
          registro y lo retira de operación.
        </p>
      </div>

      {result.message ? (
        <CatalogFeedback
          tone={result.status === "success" ? "success" : "error"}
          message={result.message}
        />
      ) : null}

      {status === "archived" ? (
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => run(restoreProductAction)}
        >
          {pending ? "Restaurando…" : "Restaurar como borrador"}
        </Button>
      ) : (
        <div className="flex flex-wrap gap-3">
          {published ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => run(unpublishProductAction)}
            >
              {pending ? "Actualizando…" : "Despublicar"}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={pending}
              onClick={() => run(publishProductAction)}
            >
              {pending ? "Publicando…" : "Publicar"}
            </Button>
          )}
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => setConfirmingArchive(true)}
          >
            Archivar
          </Button>
        </div>
      )}

      {confirmingArchive ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="font-medium text-red-950">¿Archivar este producto?</p>
          <p className="mt-1 text-sm text-red-900">
            Dejará de estar publicado, pero no se eliminará y podrás restaurarlo
            después.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => run(archiveProductAction)}
            >
              {pending ? "Archivando…" : "Sí, archivar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirmingArchive(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
