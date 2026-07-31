export default function TaxonomiesLoading() {
  return (
    <div className="space-y-5" role="status" aria-live="polite">
      <div className="bg-muted h-8 w-64 animate-pulse rounded" />
      <div className="bg-muted h-28 animate-pulse rounded-xl" />
      <p className="text-muted-foreground text-sm">Cargando taxonomías…</p>
    </div>
  );
}
