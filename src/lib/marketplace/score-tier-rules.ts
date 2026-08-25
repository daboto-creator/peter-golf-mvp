import type { Database } from "@/types/database.types";

export type PartnerTier =
  Database["public"]["Enums"]["marketplace_partner_tier"];
export type PartnerScoreStatus =
  Database["public"]["Enums"]["partner_score_status"];
export type PartnerScoreComponent =
  Database["public"]["Enums"]["partner_score_component"];

export const tierOrder: PartnerTier[] = [
  "BOGEY",
  "PAR",
  "BIRDIE",
  "ALBATROSS",
  "HOLE_IN_ONE",
];

export const tierCopy: Record<PartnerTier, string> = {
  BOGEY: "Bogey",
  PAR: "Par",
  BIRDIE: "Birdie",
  ALBATROSS: "Albatross",
  HOLE_IN_ONE: "Hole in One",
};

export const scoreComponentCopy: Record<
  PartnerScoreComponent,
  { label: string; description: string }
> = {
  ORDER_COMPLETION: {
    label: "Cumplimiento de órdenes",
    description: "Órdenes completadas correctamente.",
  },
  SHIPPING_SLA: {
    label: "Envíos",
    description: "Confirmación y entrega al carrier dentro del SLA.",
  },
  AVAILABILITY: {
    label: "Inventario disponible",
    description: "Disponibilidad real sin cancelaciones atribuibles.",
  },
  LISTING_ACCURACY: {
    label: "Exactitud de publicaciones",
    description: "Coincidencia entre publicación y producto entregado.",
  },
  CLAIMS_RETURNS: {
    label: "Reclamos",
    description: "Casos resueltos sin responsabilidad del Partner.",
  },
  GOLFER_RATING: {
    label: "Valoraciones",
    description: "Experiencia estructurada reportada por Golfers.",
  },
  DOCUMENTATION_TENURE: {
    label: "Cumplimiento de perfil",
    description: "Documentación vigente y antigüedad como Partner.",
  },
};

export function smoothScoreBps(
  scoreSumBps: number,
  observations: number,
  priorObservations = 10,
  priorSuccessEquivalent = 8,
) {
  return Math.min(
    10_000,
    Math.max(
      0,
      Math.round(
        (scoreSumBps + priorSuccessEquivalent * 10_000) /
          (observations + priorObservations),
      ),
    ),
  );
}

export function weightedScoreBps(
  components: Array<{ scoreBps: number; weightBps: number }>,
  penaltiesBps = 0,
) {
  const weighted = components.reduce(
    (total, component) =>
      total + Math.round((component.scoreBps * component.weightBps) / 10_000),
    0,
  );
  return {
    weighted: Math.min(10_000, Math.max(0, weighted)),
    final: Math.min(10_000, Math.max(0, weighted - penaltiesBps)),
  };
}

export function scoreStatusForOrders(
  completedOrders: number,
  threshold = 5,
): PartnerScoreStatus {
  return completedOrders >= threshold ? "ESTABLISHED" : "PROVISIONAL";
}

export type TierRequirement = {
  tier: PartnerTier;
  minimumAverage: number;
  minimumScoreBps: number;
};

export function highestEligibleTier(
  averageListings: number,
  scoreBps: number,
  status: PartnerScoreStatus,
  requirements: TierRequirement[],
  provisionalCap: PartnerTier = "PAR",
): PartnerTier {
  const capRank = tierOrder.indexOf(provisionalCap);
  return (
    [...requirements]
      .sort(
        (left, right) =>
          tierOrder.indexOf(right.tier) - tierOrder.indexOf(left.tier),
      )
      .find(
        (requirement) =>
          averageListings >= requirement.minimumAverage &&
          scoreBps >= requirement.minimumScoreBps &&
          (status === "ESTABLISHED" ||
            tierOrder.indexOf(requirement.tier) <= capRank),
      )?.tier ?? "BOGEY"
  );
}

export function stabilityReached(
  eligibleSince: string,
  asOfDate: string,
  requiredDays: number,
) {
  if (requiredDays === 0) return true;
  const start = Date.parse(`${eligibleSince}T00:00:00Z`);
  const end = Date.parse(`${asOfDate}T00:00:00Z`);
  return Math.floor((end - start) / 86_400_000) + 1 >= requiredDays;
}

export function scoreDescriptor(scoreBps: number) {
  if (scoreBps >= 9_000) return "Excelente";
  if (scoreBps >= 8_000) return "Muy bueno";
  if (scoreBps >= 7_000) return "Bueno";
  return "A mejorar";
}

export function displayScore(scoreBps: number) {
  return Math.round(scoreBps / 100);
}
