import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AddPenaltyForm,
  ClearOverrideForm,
  ClearPenaltyForm,
  CreateOverrideForm,
  RecalculateScoreForm,
} from "@/components/marketplace/score-tier-forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getScoreTierCapabilities,
  requireScoreTierManager,
} from "@/lib/auth/marketplace-authorization";
import { getPartnerScoreForOperations } from "@/lib/marketplace/score-tier-data";
import {
  displayScore,
  scoreComponentCopy,
  tierCopy,
} from "@/lib/marketplace/score-tier-rules";

export default async function PartnerScoreOperationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireScoreTierManager(`/operacion/marketplace/partners/${id}/score`);
  const [result, capabilities] = await Promise.all([
    getPartnerScoreForOperations(id),
    getScoreTierCapabilities(),
  ]);
  if (!result.partner || result.error) notFound();
  const name =
    result.partner.commercial_name ||
    [result.partner.first_name, result.partner.last_name]
      .filter(Boolean)
      .join(" ") ||
    "Partner";
  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
            Operations · Score y Tier
          </p>
          <h1 className="mt-3 text-4xl font-semibold">{name}</h1>
          <p className="text-muted-foreground mt-2">
            Evidencia precisa para Operations; no es una reputación pública.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/operacion/marketplace/partners/${id}`}>
            Volver al perfil
          </Link>
        </Button>
      </header>
      {result.state && result.snapshot ? (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Score"
              value={`${displayScore(result.snapshot.final_score_bps)} / 100`}
              detail={result.snapshot.score_status}
            />
            <Metric
              label="Tier actual"
              value={tierCopy[result.state.current_tier]}
              detail={`Elegible: ${tierCopy[result.state.highest_eligible_tier]}`}
            />
            <Metric
              label="Promedio listings"
              value={Number(
                result.state.rolling_average_active_listings,
              ).toFixed(2)}
              detail="Ventana elegible vigente"
            />
            <Metric
              label="Penalties"
              value={`-${displayScore(result.snapshot.active_penalties_bps)}`}
              detail={`${result.snapshot.completed_orders} órdenes elegibles`}
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Componentes auditables</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="p-3">Componente</th>
                      <th className="p-3">Score</th>
                      <th className="p-3">Muestra</th>
                      <th className="p-3">Peso</th>
                      <th className="p-3">Contribución</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.components.map((component) => (
                      <tr
                        key={component.component}
                        className="border-b last:border-0"
                      >
                        <td className="p-3 font-medium">
                          {scoreComponentCopy[component.component].label}
                        </td>
                        <td className="p-3">
                          {displayScore(component.adjusted_score_bps)}
                        </td>
                        <td className="p-3">{component.observation_count}</td>
                        <td className="p-3">
                          {(component.weight_bps / 100).toFixed(0)}%
                        </td>
                        <td className="p-3">
                          {(component.weighted_contribution_bps / 100).toFixed(
                            2,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Timers de nivel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  Candidate de promoción:{" "}
                  {result.state.promotion_candidate_tier
                    ? tierCopy[result.state.promotion_candidate_tier]
                    : "Sin candidate activo"}
                </p>
                <p>
                  Promoción elegible desde:{" "}
                  {result.state.promotion_eligible_since ?? "Sin timer activo"}
                </p>
                <p>
                  Protección de nivel desde:{" "}
                  {result.state.tier_at_risk_since ?? "Sin riesgo activo"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Riesgos operativos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {result.risks.filter((risk) => risk.status === "OPEN")
                  .length ? (
                  result.risks
                    .filter((risk) => risk.status === "OPEN")
                    .map((risk) => (
                      <p key={risk.id}>
                        <strong>{risk.flag_code}</strong> · {risk.reason}
                      </p>
                    ))
                ) : (
                  <p className="text-muted-foreground">Sin flags abiertos.</p>
                )}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Actividad de cálculo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <p>
                Días medidos: <strong>{result.metrics.length}</strong>
              </p>
              <p>
                Último job:{" "}
                <strong>
                  {result.jobRuns[0]?.status ?? "Sin ejecución registrada"}
                </strong>
              </p>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Sin snapshot todavía</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              Verifica el Partner o ejecuta el job después de que exista
              elegibilidad.
            </p>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recalcular</CardTitle>
          </CardHeader>
          <CardContent>
            <RecalculateScoreForm partnerId={id} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Registrar penalización</CardTitle>
          </CardHeader>
          <CardContent>
            <AddPenaltyForm partnerId={id} />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Penalizaciones y decay</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {result.penalties.length ? (
            result.penalties.map((penalty) => (
              <article
                key={penalty.id}
                className="rounded-xl border p-4 text-sm"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <strong>{penalty.event_code}</strong>
                  <span>
                    {penalty.severity} · {penalty.status} · -
                    {displayScore(penalty.penalty_bps)}
                  </span>
                </div>
                <p className="mt-2">{penalty.reason}</p>
                <p className="text-muted-foreground mt-1">
                  {penalty.expires_at
                    ? `Expira ${new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(penalty.expires_at))}`
                    : "Sin expiración automática"}
                </p>
                {penalty.status === "ACTIVE" ? (
                  <ClearPenaltyForm partnerId={id} penaltyId={penalty.id} />
                ) : null}
              </article>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">Sin penalizaciones.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Overrides administrativos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {capabilities.canOverride ? (
            <CreateOverrideForm partnerId={id} />
          ) : (
            <p className="text-muted-foreground text-sm">
              Sólo Admin puede crear overrides. Operations conserva lectura y
              recálculo.
            </p>
          )}
          {result.overrides.map((override) => (
            <article
              key={override.id}
              className="rounded-xl border p-4 text-sm"
            >
              <strong>
                {override.override_type}:{" "}
                {override.score_bps !== null
                  ? displayScore(override.score_bps)
                  : override.tier
                    ? tierCopy[override.tier]
                    : "—"}
              </strong>
              <p className="mt-1">{override.reason}</p>
              <p className="text-muted-foreground mt-1">
                {override.status}
                {override.expires_at
                  ? ` · expira ${new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(override.expires_at))}`
                  : ""}
              </p>
              {capabilities.canOverride && override.status === "ACTIVE" ? (
                <ClearOverrideForm partnerId={id} overrideId={override.id} />
              ) : null}
            </article>
          ))}
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Eventos recientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.events.length ? (
              result.events.map((event) => (
                <article key={event.id} className="border-l-2 pl-3 text-sm">
                  <strong>{event.outcome_code}</strong>
                  <p className="text-muted-foreground">
                    {scoreComponentCopy[event.component].label} · {event.source}{" "}
                    ·{" "}
                    {new Intl.DateTimeFormat("es-MX", {
                      dateStyle: "medium",
                    }).format(new Date(event.occurred_at))}
                  </p>
                </article>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">
                Sin eventos operativos.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Historial de Tier</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.history.length ? (
              result.history.map((entry) => (
                <article key={entry.id} className="border-l-2 pl-3 text-sm">
                  <strong>
                    {entry.old_tier ? tierCopy[entry.old_tier] : "Inicio"} →{" "}
                    {tierCopy[entry.new_tier]}
                  </strong>
                  <p>{entry.reason}</p>
                  <p className="text-muted-foreground">
                    Score snapshot · promedio{" "}
                    {Number(entry.rolling_average_active_listings).toFixed(2)}
                  </p>
                </article>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">
                Sin cambios de Tier.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold">{value}</p>
        <p className="text-muted-foreground mt-2 text-xs">{detail}</p>
      </CardContent>
    </Card>
  );
}
