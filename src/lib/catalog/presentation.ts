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
  const productStoragePathPattern =
    /^products\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;

  if (storagePath && productStoragePathPattern.test(storagePath)) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return null;
    }

    try {
      const baseUrl = new URL(supabaseUrl);
      const encodedPath = storagePath
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
      return new URL(
        `/storage/v1/object/public/product-images/${encodedPath}`,
        baseUrl,
      ).toString();
    } catch {
      return null;
    }
  }

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
