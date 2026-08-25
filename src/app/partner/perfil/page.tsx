import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMarketplacePartner } from "@/lib/auth/marketplace-authorization";
import { legalTypeCopy } from "@/lib/marketplace/partner-rules";

export default async function PartnerProfilePage() {
  const { partner } = await requireMarketplacePartner("/partner/perfil");
  const name =
    partner.legal_type === "LEGAL_ENTITY"
      ? partner.commercial_name
      : [partner.first_name, partner.last_name].filter(Boolean).join(" ");
  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-4xl font-semibold">Perfil Partner</h1>
        <p className="text-muted-foreground mt-3">
          Información privada visible sólo para ti y Operations autorizado.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>{name || "Perfil por completar"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{legalTypeCopy[partner.legal_type].label}</p>
          <p>
            {partner.city && partner.state
              ? `${partner.city}, ${partner.state}`
              : "Ubicación pendiente"}
          </p>
          <p>{partner.phone || "Teléfono pendiente"}</p>
          {partner.status === "REGISTERED" ||
          partner.status === "IDENTITY_PENDING" ? (
            <Button asChild className="mt-4">
              <Link href="/partner/onboarding/datos">Editar perfil</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
