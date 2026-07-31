import type { Database } from "@/types/database.types";

type CatalogStatus = Database["public"]["Enums"]["catalog_record_status"];

export function TaxonomyStatusBadge({ status }: { status: CatalogStatus }) {
  return (
    <span
      className={
        status === "active"
          ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800"
          : "bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-xs font-medium"
      }
    >
      {status === "active" ? "Activa" : "Archivada"}
    </span>
  );
}
