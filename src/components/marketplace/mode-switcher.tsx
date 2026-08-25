import { BriefcaseBusiness, CircleUserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { setExperienceModeAction } from "@/lib/marketplace/partner-actions";
import { getNextExperienceMode } from "@/lib/marketplace/partner-rules";

export function ModeSwitcher({
  mode,
  hasPartner,
}: {
  mode: "golfer" | "partner";
  hasPartner: boolean;
}) {
  if (!hasPartner) return null;
  const target = getNextExperienceMode(mode);
  return (
    <form action={setExperienceModeAction}>
      <input type="hidden" name="mode" value={target} />
      <Button type="submit" variant="outline" size="sm" className="shrink-0">
        {target === "partner" ? (
          <BriefcaseBusiness aria-hidden="true" />
        ) : (
          <CircleUserRound aria-hidden="true" />
        )}
        Modo {target === "partner" ? "Partner" : "Golfer"}
      </Button>
    </form>
  );
}
