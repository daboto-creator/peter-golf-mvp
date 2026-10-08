"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { discardBulkImportJob } from "@/lib/bulk-import/service";

type DiscardState = Awaited<ReturnType<typeof discardBulkImportJob>> | null;

export function BulkImportDiscardForm({ jobId, approved = false }: { jobId: string; approved?: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<DiscardState, FormData>(async (_previous, formData) => {
    const result = await discardBulkImportJob(String(formData.get("jobId") ?? ""));
    if (result.ok) router.push("/operacion/carga-masiva/historial?discarded=1");
    return result;
  }, null);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        const message = approved ? "Esta carga ya fue aprobada para importación, pero todavía no creó inventario ni publicaciones. ¿Quieres descartarla?" : "¿Descartar esta carga? Esta carga todavía no ha creado inventario ni publicaciones. Se eliminarán sus datos temporales de análisis.";
        if (!window.confirm(message)) event.preventDefault();
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="jobId" value={jobId} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>{pending ? "Descartando…" : "Descartar carga"}</Button>
      {state && !state.ok ? <span className="text-xs text-destructive">{state.message}</span> : null}
    </form>
  );
}
