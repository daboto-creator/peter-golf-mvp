export default function OrdersLoading() {
  return (
    <div className="space-y-6" aria-busy="true" role="status">
      <span className="sr-only">Cargando pedidos…</span>
      <div className="h-24 animate-pulse rounded-[20px] bg-white" />
      <div className="h-64 animate-pulse rounded-[20px] bg-white" />
    </div>
  );
}
