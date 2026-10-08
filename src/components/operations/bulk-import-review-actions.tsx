"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { reviewBulkImportAction } from "@/lib/bulk-import/service";

type State = Awaited<ReturnType<typeof reviewBulkImportAction>> | null;

export function BulkImportReviewAction({ action, jobId, rowId, label, variant = "outline" }: { action: string; jobId: string; rowId?: string; label: string; variant?: "outline" | "default" | "destructive" }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<State, FormData>(async (_previous, formData) => {
    const result = await reviewBulkImportAction(formData);
    if (result.ok) router.refresh();
    return result;
  }, null);
  return <form action={formAction} className="inline-flex flex-wrap items-center gap-2"><input type="hidden" name="action" value={action} /><input type="hidden" name="jobId" value={jobId} />{rowId ? <input type="hidden" name="rowId" value={rowId} /> : null}<Button type="submit" size="sm" variant={variant} disabled={pending}>{pending ? "Guardando…" : label}</Button>{state && !state.ok ? <span className="text-xs text-destructive">{state.message}</span> : null}</form>;
}

export function BulkImportManualFallbackForm({ jobId, rowId }: { jobId: string; rowId: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<State, FormData>(async (_previous, formData) => {
    const result = await reviewBulkImportAction(formData);
    if (result.ok) router.refresh();
    return result;
  }, null);
  return <form action={formAction} className="grid gap-2 rounded-lg border p-3"><input type="hidden" name="action" value="manual_resolution" /><input type="hidden" name="jobId" value={jobId} /><input type="hidden" name="rowId" value={rowId} /><p className="text-xs font-semibold">Usar modelo manual</p><div className="grid gap-2 sm:grid-cols-3"><input name="manualBrand" placeholder="Marca" className="h-9 rounded-lg border px-2 text-sm" /><input name="manualModel" placeholder="Modelo" className="h-9 rounded-lg border px-2 text-sm" /><input name="manualYear" placeholder="Año (opcional)" className="h-9 rounded-lg border px-2 text-sm" /></div><Button type="submit" size="sm" variant="outline" disabled={pending}>{pending ? "Guardando…" : "Guardar modelo manual"}</Button>{state && !state.ok ? <span className="text-xs text-destructive">{state.message}</span> : null}</form>;
}
