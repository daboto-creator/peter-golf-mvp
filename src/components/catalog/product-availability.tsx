import {
  getAvailabilityPresentation,
  type AvailabilityPresentation,
} from "@/lib/catalog/presentation";
import type { Database } from "@/types/database.types";
import { cn } from "@/lib/utils";

type FulfillmentType = Database["public"]["Enums"]["fulfillment_type"];

const toneClasses: Record<AvailabilityPresentation["tone"], string> = {
  available: "border-emerald-700/20 bg-emerald-50 text-emerald-800",
  order: "border-amber-700/20 bg-amber-50 text-amber-900",
  preorder: "border-blue-700/20 bg-blue-50 text-blue-900",
};

export function ProductAvailability({
  fulfillmentType,
  leadTimeMinDays,
  leadTimeMaxDays,
  showDetail = false,
}: {
  fulfillmentType: FulfillmentType;
  leadTimeMinDays: number | null;
  leadTimeMaxDays: number | null;
  showDetail?: boolean;
}) {
  const availability = getAvailabilityPresentation({
    fulfillmentType,
    leadTimeMinDays,
    leadTimeMaxDays,
  });

  return (
    <div className="space-y-1.5">
      <span
        className={cn(
          "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
          toneClasses[availability.tone],
        )}
      >
        {availability.label}
      </span>
      {showDetail ? (
        <p className="text-muted-foreground text-sm">{availability.detail}</p>
      ) : null}
    </div>
  );
}
