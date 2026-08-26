import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { requireMarketplaceClaimsManager } from "@/lib/auth/marketplace-authorization";
import { getOperationsClaims } from "@/lib/marketplace/claim-data";
import { claimReasonLabel } from "@/lib/marketplace/claim-rules";

export default async function MarketplaceClaimsPage() {
  await requireMarketplaceClaimsManager("/operacion/marketplace/reclamos");
  const result = await getOperationsClaims();
  return (
    <div className="space-y-8">
      <header>
        <p className="text-pg-gold text-xs font-semibold uppercase">
          Marketplace · Operaciones
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Reclamos Marketplace</h1>
        <p className="text-muted-foreground mt-3">
          Evidencia, resolución e impacto financiero mediado por Best Round.
        </p>
      </header>
      {result.error ? (
        <p role="alert">No pudimos cargar los reclamos.</p>
      ) : null}
      <div className="grid gap-4">
        {result.data.map((claim) => (
          <Link
            key={claim.id}
            href={`/operacion/marketplace/reclamos/${claim.id}`}
          >
            <Card className="transition hover:border-black">
              <CardContent className="grid gap-2 p-5 sm:grid-cols-4">
                <p className="font-semibold">{claim.id.slice(0, 8)}</p>
                <p>{claimReasonLabel(claim.reason)}</p>
                <p>{claim.status}</p>
                <p className="sm:text-right">
                  {new Date(claim.opened_at).toLocaleDateString("es-MX")}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
