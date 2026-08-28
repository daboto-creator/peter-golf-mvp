import { MarketplaceActivationForm } from "@/components/marketplace/activation-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMarketplaceConfigurationManager } from "@/lib/auth/marketplace-authorization";
import { getMarketplaceActivationReadiness } from "@/lib/marketplace/publication-data";

const blockerCopy: Record<string, string> = {
  NOT_STAGING: "El runtime no está identificado como staging.",
  DEPLOYMENT_GATE_OFF: "El deployment gate server-side está apagado.",
  PAYMENTS_NOT_TEST: "Payments no está en modo test.",
  STRIPE_NOT_TEST: "Stripe Checkout no está en modo test.",
  STRIPE_KEY_NOT_TEST: "La llave Stripe no es de prueba.",
  STRIPE_WEBHOOK_MISSING: "Falta el secreto del webhook de prueba.",
  SERVICE_ROLE_MISSING: "Falta el acceso server-only para imágenes/webhooks.",
  MARKETPLACE_SETTING_INVALID: "La configuración Marketplace está dañada.",
  ENVIRONMENT_NOT_STAGING:
    "La base de datos no está identificada inequívocamente como staging.",
  CONFIG_CORRUPT: "La configuración publicada no es única.",
  RULES_MISSING: "Faltan reglas críticas publicadas.",
};

export const dynamic = "force-dynamic";

export default async function MarketplaceConfigurationPage() {
  await requireMarketplaceConfigurationManager(
    "/operacion/marketplace/configuracion",
  );
  const readiness = await getMarketplaceActivationReadiness();
  const blockers = readiness
    ? [...readiness.databaseBlockers, ...readiness.environmentBlockers]
    : ["READINESS_UNAVAILABLE"];
  return (
    <div className="space-y-8">
      <header>
        <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
          Marketplace
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Activación pública</h1>
        <p className="text-muted-foreground mt-3 max-w-3xl">
          Control server-side auditado. Esta acción no cancela órdenes,
          reservas, reclamos, payables ni payouts existentes.
        </p>
      </header>
      <div className="grid gap-5 md:grid-cols-3">
        <StatusCard
          title="Marketplace"
          value={readiness?.enabled ? "ON" : "OFF"}
        />
        <StatusCard
          title="Readiness"
          value={readiness?.ready ? "READY" : "BLOCKED"}
        />
        <StatusCard
          title="Listings elegibles"
          value={String(readiness?.eligibleListingCount ?? 0)}
        />
      </div>
      {blockers.length ? (
        <Card className="border-amber-700/30 bg-amber-50">
          <CardHeader>
            <CardTitle>Bloqueos</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm">
              {blockers.map((blocker) => (
                <li key={blocker}>
                  {blockerCopy[blocker] ?? "No pudimos verificar readiness."}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      {readiness ? (
        <MarketplaceActivationForm enabled={readiness.enabled} />
      ) : null}
    </div>
  );
}

function StatusCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">{value}</CardContent>
    </Card>
  );
}
