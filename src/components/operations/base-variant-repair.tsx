"use client";

import { useState, useTransition } from "react";

import { CatalogFeedback } from "@/components/operations/catalog-feedback";
import { Button } from "@/components/ui/button";
import type { CatalogActionResult } from "@/lib/catalog/catalog-action-state";
import { repairProductBaseVariantAction } from "@/lib/catalog/operational-actions";

export function BaseVariantRepair({ productId }: { productId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CatalogActionResult>({ status: "idle" });

  function repair() {
    startTransition(async () => {
      setResult(await repairProductBaseVariantAction(productId));
    });
  }

  return (
    <CardContentLayout>
      {result.message ? (
        <CatalogFeedback
          tone={result.status === "success" ? "success" : "error"}
          message={result.message}
        />
      ) : null}
      <Button type="button" disabled={pending} onClick={repair}>
        {pending ? "Creando variante…" : "Crear variante base"}
      </Button>
    </CardContentLayout>
  );
}

function CardContentLayout({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}
