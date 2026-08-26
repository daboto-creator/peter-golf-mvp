import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";

import {
  ClaimWorkflowForm,
  EvidenceVisibilityForm,
  ReturnWorkflowForm,
} from "@/components/marketplace/claim-action-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireMarketplaceClaimsManager } from "@/lib/auth/marketplace-authorization";
import {
  resolveClaimAction,
  setClaimEvidencePartnerVisibilityAction,
  transitionMarketplaceReturnAction,
  updateClaimReviewAction,
} from "@/lib/marketplace/claim-actions";
import { getOperationsClaimDetail } from "@/lib/marketplace/claim-data";
import { claimReasonLabel } from "@/lib/marketplace/claim-rules";
import { formatMoneyMinorUnits } from "@/lib/catalog/presentation";

export default async function MarketplaceClaimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireMarketplaceClaimsManager(
    `/operacion/marketplace/reclamos/${id}`,
  );
  const detail = await getOperationsClaimDetail(id);
  if (!detail.claim) notFound();
  return (
    <div className="space-y-8">
      <header>
        <p className="text-pg-gold text-xs font-semibold uppercase">
          Reclamo {id.slice(0, 8)}
        </p>
        <h1 className="mt-3 text-4xl font-semibold">Resolución Marketplace</h1>
        <p className="text-muted-foreground mt-3">
          {claimReasonLabel(detail.claim.reason)} · {detail.claim.status}
        </p>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Snapshot original</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{detail.snapshot?.listing_title}</p>
            <p>Condición: {detail.snapshot?.condition_snapshot}</p>
            <p>Versión: {detail.claim.listing_version_id}</p>
            <p>
              Neto bloqueado:{" "}
              {formatMoneyMinorUnits(
                Number(detail.payable?.original_amount_cents ?? 0),
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Reporte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{detail.claim.description}</p>
            <p>Responsabilidad: {detail.claim.responsibility ?? "Pendiente"}</p>
            <p>Evidencia registrada: {detail.evidence.length}</p>
            <p>Refund: {detail.claim.refund_status}</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Evidencia privada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {detail.evidence.length ? (
            detail.evidence.map((evidence) => (
              <div
                key={evidence.id}
                className="grid gap-3 border-t pt-3 sm:grid-cols-[1fr_auto]"
              >
                <div className="text-sm">
                  <p>{evidence.note || "Sin nota"}</p>
                  <p className="text-muted-foreground">
                    {evidence.mime_type} ·{" "}
                    {Math.ceil(evidence.size_bytes / 1024)} KB
                  </p>
                  {evidence.signedUrl ? (
                    <a
                      href={evidence.signedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      Ver evidencia (enlace temporal)
                    </a>
                  ) : (
                    <p>No se pudo generar el enlace temporal.</p>
                  )}
                </div>
                <EvidenceVisibilityForm
                  action={setClaimEvidencePartnerVisibilityAction}
                  claimId={id}
                  evidenceId={evidence.id}
                  partnerVisible={evidence.partner_visible}
                  idempotencyKey={randomUUID()}
                />
              </div>
            ))
          ) : (
            <p className="text-sm">Sin archivos registrados.</p>
          )}
        </CardContent>
      </Card>
      {!detail.resolution ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <ClaimWorkflowForm
            action={updateClaimReviewAction}
            claimId={id}
            idempotencyKey={randomUUID()}
            mode="review"
          />
          <ClaimWorkflowForm
            action={resolveClaimAction}
            claimId={id}
            idempotencyKey={randomUUID()}
            mode="resolve"
          />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Resolución final</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              {detail.resolution.decision} · {detail.resolution.reason}
            </p>
          </CardContent>
        </Card>
      )}
      {detail.marketplaceReturn ? (
        <Card>
          <CardHeader>
            <CardTitle>Devolución</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              Estado: {detail.marketplaceReturn.status} · Responsabilidad:{" "}
              {detail.marketplaceReturn.shipping_responsibility}
            </p>
            <ReturnWorkflowForm
              action={transitionMarketplaceReturnAction}
              claimId={id}
              returnId={detail.marketplaceReturn.id}
              currentStatus={detail.marketplaceReturn.status}
              idempotencyKey={randomUUID()}
            />
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Historial</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {detail.events.map((event) => (
            <p key={event.id}>
              {event.event_type} · {event.reason}
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
