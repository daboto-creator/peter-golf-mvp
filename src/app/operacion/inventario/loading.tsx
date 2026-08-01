export default function InventoryLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="h-9 w-56 animate-pulse rounded bg-zinc-200" />
      <div className="h-32 animate-pulse rounded-xl bg-zinc-100" />
      <div className="h-72 animate-pulse rounded-xl bg-zinc-100" />
      <span className="sr-only">Cargando inventario…</span>
    </div>
  );
}
