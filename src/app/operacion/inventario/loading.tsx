export default function InventoryLoading() {
  return (
    <div className="space-y-6" aria-busy="true" role="status">
      <span className="sr-only">Cargando inventario…</span>
      <div className="h-10 w-56 animate-pulse rounded-xl bg-zinc-200" />
      <div className="h-32 animate-pulse rounded-[20px] bg-white" />
      <div className="h-72 animate-pulse rounded-[20px] bg-white" />
    </div>
  );
}
