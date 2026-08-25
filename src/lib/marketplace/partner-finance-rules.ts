export type PartnerPayableStatus =
  "PENDING" | "ON_HOLD" | "AVAILABLE" | "PAID" | "REVERSED";

export type PartnerLedgerDelta = {
  pendingCents: number;
  onHoldCents: number;
  availableCents: number;
  paidCents: number;
  reversedCents: number;
};

export function reconstructPartnerBalance(entries: PartnerLedgerDelta[]) {
  const balance = entries.reduce(
    (result, entry) => ({
      pendingCents: result.pendingCents + entry.pendingCents,
      onHoldCents: result.onHoldCents + entry.onHoldCents,
      availableCents: result.availableCents + entry.availableCents,
      paidCents: result.paidCents + entry.paidCents,
      reversedCents: result.reversedCents + entry.reversedCents,
    }),
    {
      pendingCents: 0,
      onHoldCents: 0,
      availableCents: 0,
      paidCents: 0,
      reversedCents: 0,
    },
  );
  return {
    ...balance,
    netPositionCents:
      balance.pendingCents +
      balance.onHoldCents +
      balance.availableCents +
      balance.paidCents,
  };
}

export function canPlacePayableHold(status: PartnerPayableStatus) {
  return status === "PENDING" || status === "ON_HOLD" || status === "AVAILABLE";
}

export function canReleasePayable(input: {
  status: PartnerPayableStatus;
  activeHolds: number;
  fulfillmentStatus: string;
}) {
  return (
    input.status === "PENDING" &&
    input.activeHolds === 0 &&
    ["DELIVERED", "ACCEPTANCE_PENDING", "COMPLETED"].includes(
      input.fulfillmentStatus,
    )
  );
}

export function canReversePayable(status: PartnerPayableStatus) {
  return status === "PENDING" || status === "ON_HOLD" || status === "AVAILABLE";
}

export function partnerPayableLabel(status: PartnerPayableStatus) {
  const labels: Record<PartnerPayableStatus, string> = {
    PENDING: "Saldo pendiente",
    ON_HOLD: "En revisión",
    AVAILABLE: "Disponible para próximo pago",
    PAID: "Pago realizado",
    REVERSED: "Revertido",
  };
  return labels[status];
}
