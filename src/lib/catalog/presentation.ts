import type { Database } from "@/types/database.types";

type FulfillmentType = Database["public"]["Enums"]["fulfillment_type"];
type ProductCondition = Database["public"]["Enums"]["product_condition"];
type ProductConditionGrade =
  Database["public"]["Enums"]["product_condition_grade"];

export type AvailabilityPresentation = {
  label: string;
  detail: string;
  tone: "available" | "order" | "preorder";
};

const conditionGradeLabels: Record<ProductConditionGrade, string> = {
  like_new: "Como nuevo",
  excellent: "Excelente",
  very_good: "Muy bueno",
  good: "Bueno",
  fair: "Con desgaste visible",
};

export function formatMoneyMinorUnits(
  amount: number,
  currency = "MXN",
): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

export function getConditionLabel(
  condition: ProductCondition,
  grade: ProductConditionGrade | null,
): string {
  if (condition === "new") {
    return "Nuevo";
  }

  return grade ? `Seminuevo · ${conditionGradeLabels[grade]}` : "Seminuevo";
}

export function getAvailabilityPresentation({
  fulfillmentType,
  leadTimeMinDays,
  leadTimeMaxDays,
}: {
  fulfillmentType: FulfillmentType;
  leadTimeMinDays: number | null;
  leadTimeMaxDays: number | null;
}): AvailabilityPresentation {
  const leadTime =
    leadTimeMinDays !== null && leadTimeMaxDays !== null
      ? `Plazo estimado: ${leadTimeMinDays}–${leadTimeMaxDays} días.`
      : "Confirmaremos el plazo antes de la compra.";

  if (fulfillmentType === "special_order") {
    return {
      label: "Sobre pedido",
      detail: leadTime,
      tone: "order",
    };
  }

  if (fulfillmentType === "preorder") {
    return {
      label: "Preventa",
      detail: leadTime,
      tone: "preorder",
    };
  }

  return {
    label: "Disponible",
    detail: "Existencia sujeta a confirmación.",
    tone: "available",
  };
}

export function resolvePublicImagePath(
  storagePath: string | null,
): string | null {
  if (
    !storagePath ||
    !storagePath.startsWith("/") ||
    storagePath.startsWith("//") ||
    storagePath.includes("\\") ||
    storagePath.includes("..") ||
    storagePath.includes("%") ||
    storagePath.includes("?") ||
    storagePath.includes("#")
  ) {
    return null;
  }

  return storagePath;
}
