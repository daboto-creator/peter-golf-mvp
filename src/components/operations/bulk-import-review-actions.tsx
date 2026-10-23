"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { executeFirstPartyBulkImportAction, executePartnerBulkImportAction, reviewBulkImportAction } from "@/lib/bulk-import/service";
import { getManualModelResolution } from "@/lib/bulk-import/review-reconciliation";

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

export function BulkImportManualFallbackForm({ jobId, rowId, manualResolution, normalizedPayload }: { jobId: string; rowId: string; manualResolution?: Record<string, unknown> | null; normalizedPayload?: Record<string, unknown> | null }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<State, FormData>(async (_previous, formData) => {
    const result = await reviewBulkImportAction(formData);
    if (result.ok) router.refresh();
    return result;
  }, null);
  const model = getManualModelResolution(manualResolution, normalizedPayload);
  const active = Boolean(model?.approved);
  return <form action={formAction} className="grid gap-2 rounded-lg border p-3"><input type="hidden" name="action" value="manual_resolution" /><input type="hidden" name="jobId" value={jobId} /><input type="hidden" name="rowId" value={rowId} /><p className="text-xs font-semibold">{active ? "Modelo manual activo" : "Usar modelo manual"}</p><div className="grid gap-2 sm:grid-cols-3"><input name="manualBrand" defaultValue={active ? String(model?.brand ?? "") : ""} placeholder="Marca" className="h-9 rounded-lg border px-2 text-sm" /><input name="manualModel" defaultValue={active ? String(model?.model ?? "") : ""} placeholder="Modelo" className="h-9 rounded-lg border px-2 text-sm" /><input name="manualYear" defaultValue={active && model?.modelYear != null ? String(model.modelYear) : ""} placeholder="Año (opcional)" className="h-9 rounded-lg border px-2 text-sm" /></div><Button type="submit" size="sm" variant="outline" disabled={pending}>{pending ? "Guardando…" : active ? "Editar modelo manual" : "Guardar modelo manual"}</Button>{state && !state.ok ? <span className="text-xs text-destructive">{state.message}</span> : null}</form>;
}

export function BulkImportExecutionAction({ jobId, retry = false }: { jobId: string; retry?: boolean }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<State, FormData>(async (_previous, formData) => {
    const result = await executeFirstPartyBulkImportAction(String(formData.get("jobId") ?? ""));
    if (result.ok) router.refresh();
    return result;
  }, null);
  return <form action={formAction} className="inline-flex flex-wrap items-center gap-2" onSubmit={(event) => { if (!window.confirm(retry ? "¿Reintentar las filas fallidas? Las filas importadas no se modificarán." : "¿Crear productos e inventario? Esta acción creará inventario real de Best Round.")) event.preventDefault(); }}><input type="hidden" name="jobId" value={jobId} /><Button type="submit" size="sm" disabled={pending}>{pending ? "Importando…" : retry ? "Reintentar filas fallidas" : "Crear productos e inventario"}</Button>{state && !state.ok ? <span className="text-xs text-destructive">{state.message}</span> : null}</form>;
}

export function BulkImportPartnerExecutionAction({ jobId, retry = false }: { jobId: string; retry?: boolean }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<State, FormData>(async (_previous, formData) => {
    const result = await executePartnerBulkImportAction(String(formData.get("jobId") ?? ""));
    if (result.ok) router.refresh();
    return result;
  }, null);
  return <form action={formAction} className="inline-flex flex-wrap items-center gap-2" onSubmit={(event) => { if (!window.confirm(retry ? "¿Reintentar las filas fallidas? Los borradores existentes no se modificarán." : "¿Crear borradores de publicaciones? Esta acción no publicará automáticamente.")) event.preventDefault(); }}><input type="hidden" name="jobId" value={jobId} /><Button type="submit" size="sm" disabled={pending}>{pending ? "Creando borradores…" : retry ? "Reintentar filas fallidas" : "Crear borradores de publicaciones"}</Button>{state && !state.ok ? <span className="text-xs text-destructive">{state.message}</span> : null}</form>;
}

export function BulkImportManualPriceForm({ jobId, rowId, currentPrice }: { jobId: string; rowId: string; currentPrice?: number | null }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<State, FormData>(async (_previous, formData) => {
    const result = await reviewBulkImportAction(formData);
    if (result.ok) router.refresh();
    return result;
  }, null);
  return <form action={formAction} className="grid gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3"><input type="hidden" name="action" value="manual_price_resolution" /><input type="hidden" name="jobId" value={jobId} /><input type="hidden" name="rowId" value={rowId} /><p className="text-xs font-semibold">Revisar precio</p><input name="approvedPrice" defaultValue={currentPrice == null ? "" : (currentPrice / 100).toFixed(2)} inputMode="decimal" placeholder="Precio de venta (MXN)" className="h-9 rounded-lg border px-2 text-sm" /><input name="reason" placeholder="Motivo (opcional)" className="h-9 rounded-lg border px-2 text-sm" /><Button type="submit" size="sm" variant="outline" disabled={pending}>{pending ? "Guardando…" : "Aprobar precio manualmente"}</Button>{state && !state.ok ? <span className="text-xs text-destructive">{state.message}</span> : null}</form>;
}

export function BulkImportEditRowForm({ jobId, rowId, row, currentPrice, pricingResult, importType = "FIRST_PARTY" }: { jobId: string; rowId: string; row: Record<string, unknown>; currentPrice?: number | null; pricingResult?: Record<string, unknown> | null; importType?: "FIRST_PARTY" | "PARTNER" }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<State, FormData>(async (_previous, formData) => {
    const result = await reviewBulkImportAction(formData);
    if (result.ok) router.refresh();
    return result;
  }, null);
  const price = Number(currentPrice ?? row.askingPriceMinor ?? 0);
  const cost = Number(row.acquisitionCostMinor ?? 0);
  const desiredNet = Number(row.desiredNetMinor ?? 0);
  const calculated = Number(pricingResult?.approvedPriceMinor ?? pricingResult?.calculatedPublicPriceMinor ?? pricingResult?.proposedPriceMinor ?? 0);
  const estimatedNet = Number(pricingResult?.estimatedPartnerNetMinor ?? 0);
  return <details className="rounded-lg border p-3">
    <summary className="cursor-pointer text-xs font-semibold underline">Editar fila</summary>
    <form action={formAction} className="mt-2 grid gap-2">
      <input type="hidden" name="action" value="edit_row" /><input type="hidden" name="jobId" value={jobId} /><input type="hidden" name="rowId" value={rowId} />
      <label className="text-xs">Categoría<select name="category" defaultValue={String(row.category ?? "")} className="mt-1 h-9 w-full rounded-lg border px-2 text-sm"><option value="">Selecciona una categoría</option><option value="driver">Driver</option><option value="fairway-wood">Madera de calle</option><option value="hybrid">Híbrido</option><option value="iron">Hierros</option><option value="wedge">Wedges</option><option value="putter">Putter</option></select></label>
      <div className="grid gap-2 sm:grid-cols-2"><label className="text-xs">Marca<input name="brand" defaultValue={String(row.brand ?? "")} className="mt-1 h-9 w-full rounded-lg border px-2 text-sm" /></label><label className="text-xs">Modelo<input name="model" defaultValue={String(row.model ?? "")} className="mt-1 h-9 w-full rounded-lg border px-2 text-sm" /></label></div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs">{importType === "PARTNER" ? "Precio público solicitado (MXN)" : "Precio de venta (MXN)"}<input name={importType === "PARTNER" ? "publicPrice" : "salePrice"} defaultValue={price > 0 ? (price / 100).toFixed(2) : ""} inputMode="decimal" className="mt-1 h-9 w-full rounded-lg border px-2 text-sm" /></label>
        {importType === "PARTNER" ? <label className="text-xs">Neto deseado Partner (MXN)<input name="desiredNet" defaultValue={desiredNet > 0 ? (desiredNet / 100).toFixed(2) : ""} inputMode="decimal" className="mt-1 h-9 w-full rounded-lg border px-2 text-sm" /></label> : <label className="text-xs">Costo adquisición (MXN)<input name="acquisitionCost" defaultValue={cost > 0 ? (cost / 100).toFixed(2) : ""} inputMode="decimal" className="mt-1 h-9 w-full rounded-lg border px-2 text-sm" /></label>}
        <label className="text-xs">Cantidad<input name="quantity" defaultValue={String(row.quantity ?? "")} inputMode="numeric" className="mt-1 h-9 w-full rounded-lg border px-2 text-sm" /></label>
        <label className="text-xs">Año<input name="modelYear" defaultValue={String(row.modelYear ?? "")} inputMode="numeric" className="mt-1 h-9 w-full rounded-lg border px-2 text-sm" /></label>
        <label className="text-xs">Condición<select name="condition" defaultValue={String(row.condition ?? "")} className="mt-1 h-9 w-full rounded-lg border px-2 text-sm"><option value="new">Nuevo</option><option value="used">Usado</option></select></label>
        <label className="text-xs">Mano<select name="hand" defaultValue={String(row.hand ?? "")} className="mt-1 h-9 w-full rounded-lg border px-2 text-sm"><option value="RIGHT">Derecho</option><option value="LEFT">Izquierdo</option></select></label>
      </div>
      {importType === "PARTNER" && calculated > 0 ? <p className="text-xs text-muted-foreground">Precio público calculado: ${(calculated / 100).toFixed(2)}{estimatedNet > 0 ? ` · Neto estimado Partner: $${(estimatedNet / 100).toFixed(2)}` : ""}</p> : null}
      <label className="text-xs">Clave fotos<input name="photoKey" defaultValue={String(row.photoKey ?? "")} className="mt-1 h-9 w-full rounded-lg border px-2 text-sm" /></label>
      <input name="reason" placeholder="Motivo de cambio (opcional)" className="h-9 rounded-lg border px-2 text-sm" /><Button type="submit" size="sm" variant="outline" disabled={pending}>{pending ? "Guardando…" : importType === "PARTNER" ? "Recalcular y aprobar precio" : "Guardar cambios"}</Button>{state && !state.ok ? <span className="text-xs text-destructive">{state.message}</span> : null}
    </form>
  </details>;
}

export function BulkImportCanonicalYearAction({ jobId, rowId, year }: { jobId: string; rowId: string; year: number }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<State, FormData>(async (_previous, formData) => {
    const result = await reviewBulkImportAction(formData);
    if (result.ok) router.refresh();
    return result;
  }, null);
  return <form action={formAction} className="inline-flex flex-wrap items-center gap-2"><input type="hidden" name="action" value="use_canonical_year" /><input type="hidden" name="jobId" value={jobId} /><input type="hidden" name="rowId" value={rowId} /><input type="hidden" name="canonicalYear" value={year} /><Button type="submit" size="sm" variant="outline" disabled={pending}>{pending ? "Guardando…" : `Usar año ${year}`}</Button>{state && !state.ok ? <span className="text-xs text-destructive">{state.message}</span> : null}</form>;
}
