import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types";

type ProductStatus = Database["public"]["Enums"]["product_status"];

export function ProductStatusBadge({
  status,
  published,
}: {
  status: ProductStatus;
  published: boolean;
}) {
  const label =
    status === "archived" ? "Archivado" : published ? "Publicado" : "Borrador";

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
        status === "archived" && "bg-muted text-muted-foreground",
        status !== "archived" &&
          published &&
          "border-emerald-700/20 bg-emerald-50 text-emerald-800",
        status !== "archived" &&
          !published &&
          "border-amber-700/20 bg-amber-50 text-amber-900",
      )}
    >
      {label}
    </span>
  );
}
