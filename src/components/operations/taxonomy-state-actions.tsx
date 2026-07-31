"use client";

import { useState, useTransition } from "react";

import { CatalogFeedback } from "@/components/operations/catalog-feedback";
import { Button } from "@/components/ui/button";
import {
  changeBrandStatusAction,
  changeCategoryStatusAction,
  type TaxonomyActionResult,
} from "@/lib/catalog/taxonomy-actions";
import type { Database } from "@/types/database.types";

type CatalogStatus = Database["public"]["Enums"]["catalog_record_status"];

export function TaxonomyStateActions({
  kind,
  id,
  status,
}: {
  kind: "brand" | "category";
  id: string;
  status: CatalogStatus;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<TaxonomyActionResult>({
    status: "idle",
  });
  const targetStatus: CatalogStatus =
    status === "active" ? "archived" : "active";

  function changeStatus() {
    startTransition(async () => {
      const nextResult =
        kind === "brand"
          ? await changeBrandStatusAction(id, targetStatus)
          : await changeCategoryStatusAction(id, targetStatus);
      setResult(nextResult);
      if (nextResult.status === "success") setConfirming(false);
    });
  }

  return (
    <section className="space-y-4 rounded-xl border bg-white p-5">
      <div>
        <h2 className="font-semibold">Estado operativo</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Archivar impide nuevas asignaciones, pero conserva las relaciones
          históricas.
        </p>
      </div>
      {result.message ? (
        <CatalogFeedback
          tone={result.status === "success" ? "success" : "error"}
          message={result.message}
        />
      ) : null}
      <Button
        type="button"
        variant={status === "active" ? "destructive" : "outline"}
        disabled={pending}
        onClick={() => setConfirming(true)}
      >
        {status === "active" ? "Archivar" : "Reactivar"}
      </Button>
      {confirming ? (
        <div className="rounded-lg border bg-slate-50 p-4">
          <p className="font-medium">
            ¿Confirmas que deseas{" "}
            {status === "active" ? "archivar" : "reactivar"} este registro?
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {status === "active"
              ? "La operación se rechazará si existen dependencias activas."
              : "Volverá a estar disponible para nuevas asignaciones."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant={status === "active" ? "destructive" : "default"}
              disabled={pending}
              onClick={changeStatus}
            >
              {pending ? "Guardando…" : "Confirmar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
