export const BUYER_CLAIM_REASONS = [
  "WRONG_ITEM",
  "CONDITION_NOT_AS_DESCRIBED",
  "UNDECLARED_DAMAGE",
  "COUNTERFEIT_SUSPECTED",
  "WRONG_SPECS",
  "NON_FUNCTIONAL",
] as const;

export type BuyerClaimReason = (typeof BUYER_CLAIM_REASONS)[number];

const labels: Record<BuyerClaimReason, string> = {
  WRONG_ITEM: "Recibí un artículo distinto",
  CONDITION_NOT_AS_DESCRIBED: "La condición no coincide con la publicación",
  UNDECLARED_DAMAGE: "Tiene un daño que no fue declarado",
  COUNTERFEIT_SUSPECTED: "Tengo dudas sobre su autenticidad",
  WRONG_SPECS: "Las especificaciones no coinciden",
  NON_FUNCTIONAL: "El artículo no funciona correctamente",
};

export function isBuyerClaimReason(value: string): value is BuyerClaimReason {
  return BUYER_CLAIM_REASONS.some((reason) => reason === value);
}

export function claimReasonLabel(value: string): string {
  return isBuyerClaimReason(value) ? labels[value] : "Revisión manual";
}

export function acceptanceDeadline(deliveredAt: Date, windowHours = 48): Date {
  return new Date(deliveredAt.getTime() + windowHours * 60 * 60 * 1000);
}

export function canAutoAccept(input: {
  status: string;
  deadline: Date;
  now: Date;
  hasOpenClaim: boolean;
  hasRelevantHold: boolean;
}): boolean {
  return (
    input.status === "PENDING" &&
    input.deadline.getTime() <= input.now.getTime() &&
    !input.hasOpenClaim &&
    !input.hasRelevantHold
  );
}

export function financialEffectForDecision(
  decision: "APPROVED" | "PARTIALLY_APPROVED" | "REJECTED",
): "FULL_REVERSAL" | "PARTIAL_REVERSAL" | "NONE" {
  if (decision === "APPROVED") return "FULL_REVERSAL";
  if (decision === "PARTIALLY_APPROVED") return "PARTIAL_REVERSAL";
  return "NONE";
}
