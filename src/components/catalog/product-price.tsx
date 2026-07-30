import { formatMoneyMinorUnits } from "@/lib/catalog/presentation";
import { cn } from "@/lib/utils";

export function ProductPrice({
  price,
  compareAtPrice,
  currency,
  isEstimate = false,
  className,
}: {
  price: number;
  compareAtPrice?: number | null;
  currency: string;
  isEstimate?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}
    >
      <span className="text-lg font-semibold">
        {isEstimate ? "Precio estimado: " : ""}
        {formatMoneyMinorUnits(price, currency)}
      </span>
      {compareAtPrice !== null && compareAtPrice !== undefined ? (
        <span className="text-muted-foreground text-sm line-through">
          {formatMoneyMinorUnits(compareAtPrice, currency)}
        </span>
      ) : null}
      <span className="text-muted-foreground text-xs">{currency}</span>
    </div>
  );
}
