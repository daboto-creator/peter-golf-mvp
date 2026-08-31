import { BasicPartnerForm } from "@/components/marketplace/partner-forms";
import { requireMarketplacePartner } from "@/lib/auth/marketplace-authorization";
import { getProfileDefaults } from "@/lib/marketplace/partner-data";
import { isPartnerReadOnly } from "@/lib/marketplace/partner-rules";
import { redirect } from "next/navigation";

export default async function PartnerBasicPage() {
  const { user, partner } = await requireMarketplacePartner(
    "/partner/onboarding/datos",
  );
  if (isPartnerReadOnly(partner.status)) redirect("/partner");
  const defaults = await getProfileDefaults(user.id);
  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <header>
        <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
          Paso 1 de 4 · Datos
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Información básica</h1>
        <p className="text-muted-foreground mt-3">
          Usamos los datos de Mi Golf como punto de partida. Confírmalos o
          actualízalos.
        </p>
      </header>
      <BasicPartnerForm
        partner={{
          legal_type: partner.legal_type,
          first_name: partner.first_name,
          last_name: partner.last_name,
          phone: partner.phone,
          country_code: partner.country_code,
          state: partner.state,
          city: partner.city,
          commercial_name: partner.commercial_name,
          representative_name: partner.representative_name,
        }}
        defaults={defaults}
        email={user.email ?? ""}
      />
    </div>
  );
}
