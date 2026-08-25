import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMarketplacePartner } from "@/lib/auth/marketplace-authorization";
import { getPartnerScoreDashboard } from "@/lib/marketplace/score-tier-data";
import {
  displayScore,
  scoreComponentCopy,
  scoreDescriptor,
  tierCopy,
  tierOrder,
} from "@/lib/marketplace/score-tier-rules";

export default async function PartnerScorePage() {
  const { partner } = await requireMarketplacePartner("/partner/score");
  const result = await getPartnerScoreDashboard(partner.id);
  const { state, snapshot } = result;
  if (!state || !snapshot) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Score y nivel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p>
            Tu Score se activa cuando Best Round verifica tu cuenta Partner.
          </p>
          <p className="text-muted-foreground text-sm">
            No se usa esta sección para autorizar publicaciones ni sustituye tu
            estado de verificación.
          </p>
        </CardContent>
      </Card>
    );
  }
  const currentRank = tierOrder.indexOf(state.current_tier);
  const nextTier = tierOrder[currentRank + 1];
  const currentRequirement = result.progress.find(
    (rule) => rule.tier === state.current_tier,
  );
  const nextRequirement = result.progress.find(
    (rule) => rule.tier === nextTier,
  );
  const riskDeadline = state.tier_at_risk_since
    ? new Date(`${state.tier_at_risk_since}T12:00:00Z`)
    : null;
  if (riskDeadline && currentRequirement)
    riskDeadline.setUTCDate(
      riskDeadline.getUTCDate() + currentRequirement.downgrade_grace_days - 1,
    );
  return (
    <div className="space-y-8">
      <header>
        <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
          Best Round Partner
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Tu Score y nivel</h1>
        <p className="text-muted-foreground mt-3 max-w-2xl">
          Una vista clara de tu confiabilidad operativa y del camino al
          siguiente nivel.
        </p>
      </header>
      {snapshot.score_status === "PROVISIONAL" ? (
        <div className="border-pg-gold/40 bg-pg-gold/5 rounded-xl border p-4">
          <strong>Best Round Partner Nuevo</strong>
          <p className="text-muted-foreground mt-1 text-sm">
            Tu Score usa una base neutral y se estabiliza conforme completas
            órdenes elegibles.
          </p>
        </div>
      ) : null}
      {state.tier_at_risk_since ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <strong>Tu nivel está en periodo de protección.</strong>
          <p className="mt-1 text-sm">
            Recupera los requisitos del nivel antes de{" "}
            {riskDeadline
              ? new Intl.DateTimeFormat("es-MX", {
                  dateStyle: "medium",
                }).format(riskDeadline)
              : "terminar el periodo configurado"}
            .
          </p>
          {currentRequirement ? (
            <p className="mt-2 text-sm">
              Tu nivel requiere Score{" "}
              {displayScore(currentRequirement.minimum_score_bps)} y promedio{" "}
              {Number(currentRequirement.minimum_average_active_listings)}. Hoy
              registras Score {displayScore(snapshot.final_score_bps)} y
              promedio{" "}
              {Number(state.rolling_average_active_listings).toFixed(1)}.
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Card className="border-pg-gold/40">
          <CardHeader>
            <CardTitle>Tu nivel</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">
              {tierCopy[state.current_tier]}
            </p>
            <p className="text-muted-foreground mt-2 text-sm">
              Promedio móvil:{" "}
              {Number(state.rolling_average_active_listings).toFixed(1)}{" "}
              publicaciones elegibles.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tu Score</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className="text-4xl font-semibold"
              data-testid="partner-score-value"
            >
              {displayScore(snapshot.final_score_bps)}{" "}
              <span className="text-muted-foreground text-lg">/ 100</span>
            </p>
            <p className="text-muted-foreground mt-2 text-sm">
              {snapshot.score_status === "PROVISIONAL"
                ? "Provisional"
                : "Establecido"}{" "}
              · {snapshot.completed_orders} órdenes completadas elegibles.
            </p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Cómo vas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {result.components.map((component) => {
            const copy = scoreComponentCopy[component.component];
            return (
              <article
                key={component.component}
                className="rounded-xl border p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <strong>{copy.label}</strong>
                  <span className="text-sm font-medium">
                    {scoreDescriptor(component.adjusted_score_bps)}
                  </span>
                </div>
                <p className="text-muted-foreground mt-2 text-sm">
                  {copy.description}
                </p>
                <p className="mt-2 text-sm">
                  {displayScore(component.adjusted_score_bps)} / 100
                </p>
              </article>
            );
          })}
        </CardContent>
      </Card>
      {nextTier && nextRequirement ? (
        <Card>
          <CardHeader>
            <CardTitle>Para llegar a {tierCopy[nextTier]}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Score requerido: {displayScore(nextRequirement.minimum_score_bps)}{" "}
              —{" "}
              {snapshot.final_score_bps >= nextRequirement.minimum_score_bps
                ? "ya cumples"
                : `te faltan ${displayScore(nextRequirement.minimum_score_bps - snapshot.final_score_bps)} puntos`}
              .
            </p>
            <p>
              Promedio requerido:{" "}
              {Number(nextRequirement.minimum_average_active_listings)}{" "}
              publicaciones —{" "}
              {Number(state.rolling_average_active_listings) >=
              Number(nextRequirement.minimum_average_active_listings)
                ? "ya cumples"
                : `te faltan ${(Number(nextRequirement.minimum_average_active_listings) - Number(state.rolling_average_active_listings)).toFixed(1)}`}
              .
            </p>
            <p>
              Estabilidad: {nextRequirement.promotion_stability_days} días
              consecutivos. Cumplir hoy no promete un ascenso inmediato.
            </p>
          </CardContent>
        </Card>
      ) : null}
      {result.penalties.some((penalty) => penalty.status === "ACTIVE") ? (
        <Card>
          <CardHeader>
            <CardTitle>Aspectos activos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.penalties
              .filter((penalty) => penalty.status === "ACTIVE")
              .map((penalty) => (
                <article
                  key={penalty.id}
                  className="rounded-xl border p-4 text-sm"
                >
                  <strong>{penalty.reason}</strong>
                  <p className="text-muted-foreground mt-1">
                    Impacto: -{displayScore(penalty.penalty_bps)} puntos
                    {penalty.expires_at
                      ? ` · se revisa ${new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(penalty.expires_at))}`
                      : " · requiere revisión manual"}
                    .
                  </p>
                </article>
              ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
