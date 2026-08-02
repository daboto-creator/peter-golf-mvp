export default function OrdersLoading() {
  return (
    <div className="space-y-5" aria-busy="true">
      <span className="sr-only">Cargando pedidos…</span>
      <div className="h-24 animate-pulse rounded-xl bg-zinc-100" />
      <div className="h-64 animate-pulse rounded-xl bg-zinc-100" />
    </div>
  );
}
