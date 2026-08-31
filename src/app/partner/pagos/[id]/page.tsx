import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneyMinorUnits } from "@/lib/catalog/presentation";
import { getPartnerPayable } from "@/lib/marketplace/partner-finance-data";
import { partnerPayableLabel } from "@/lib/marketplace/partner-finance-rules";

export default async function PartnerPayableDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getPartnerPayable(id);
  if (!result.payable) notFound();
  const payable = result.payable;
  return (
    <div className="space-y-8">
      <header>
        <p className="text-pg-gold text-xs font-semibold uppercase">
          {payable.order_number}
        </p>
        <h1 className="mt-3 text-4xl font-semibold">{payable.listing_title}</h1>
        <p className="text-muted-foreground mt-3">
          {partnerPayableLabel(payable.status)}
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Resumen de tu pago</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-base font-semibold">
            Recibirás:{" "}
            {formatMoneyMinorUnits(Number(payable.payable_amount_cents))}
          </p>
          <p>Estado: {partnerPayableLabel(payable.status)}</p>
          <p className="text-muted-foreground">
            Los pagos del MVP se preparan mediante transferencia bancaria
            manual.
          </p>
        </CardContent>
      </Card>
      {result.holds.length ? (
        <Card>
          <CardHeader>
            <CardTitle>En revisión</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {result.holds.map((hold) => (
              <p key={hold.hold_id}>{hold.reason} · En revisión</p>
            ))}
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Historial visible</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {result.history.map((entry) => (
            <div key={entry.id} className="border-b pb-3 last:border-0">
              <p className="font-medium">
                {partnerPayableLabel(entry.to_status)}
              </p>
              <p className="text-muted-foreground">{entry.reason}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
