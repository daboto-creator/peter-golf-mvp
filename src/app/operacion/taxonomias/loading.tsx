export default function TaxonomiesLoading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true">
      <span className="sr-only">Cargando taxonomías…</span>
      <div className="h-10 w-64 animate-pulse rounded-xl bg-zinc-200" />
      <div className="h-28 animate-pulse rounded-[20px] bg-white" />
    </div>
  );
}
