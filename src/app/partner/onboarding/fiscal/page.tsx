import { redirect } from "next/navigation";

import { FiscalPartnerForm } from "@/components/marketplace/partner-forms";
import { requireMarketplacePartner } from "@/lib/auth/marketplace-authorization";
import { isPartnerReadOnly } from "@/lib/marketplace/partner-rules";

export default async function PartnerFiscalPage() {
  const { partner } = await requireMarketplacePartner(
    "/partner/onboarding/fiscal",
  );
  if (isPartnerReadOnly(partner.status)) redirect("/partner");
  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <header>
        <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
          Paso 3 de 4 · Documentos
        </p>
        <h1 className="mt-3 text-3xl font-semibold">
          Datos para validar tus documentos
        </h1>
        <p className="text-muted-foreground mt-3">
          Usaremos esta información para comprobar la consistencia de tu
          Constancia de Situación Fiscal y tus documentos.
        </p>
      </header>
      <FiscalPartnerForm
        partner={{
          legal_type: partner.legal_type,
          tax_id: partner.tax_id,
          legal_name: partner.legal_name,
          fiscal_address_line_1: partner.fiscal_address_line_1,
          fiscal_address_line_2: partner.fiscal_address_line_2,
          fiscal_city: partner.fiscal_city,
          fiscal_state: partner.fiscal_state,
          fiscal_postal_code: partner.fiscal_postal_code,
        }}
      />
    </div>
  );
}
