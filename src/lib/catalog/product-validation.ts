import { z } from "zod";

const MAX_MINOR_UNITS = 99_999_999_999_999;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._-]*$/;

const optionalText = (maximum: number) =>
  z.string().trim().max(maximum, `Usa ${maximum} caracteres o menos.`);

const optionalIntegerText = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d+$/.test(value), {
    message: "Escribe un número entero no negativo.",
  })
  .refine((value) => value === "" || Number(value) <= 3650, {
    message: "El plazo no puede superar 3650 días.",
  });

export const productFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "El nombre es obligatorio.")
      .max(200, "Usa 200 caracteres o menos."),
    slug: z
      .string()
      .trim()
      .max(160, "Usa 160 caracteres o menos.")
      .refine((value) => value === "" || SLUG_PATTERN.test(value), {
        message:
          "Usa sólo minúsculas, números y guiones, sin guiones al inicio o al final.",
      }),
    sku: z
      .string()
      .trim()
      .min(1, "El SKU es obligatorio.")
      .max(80, "Usa 80 caracteres o menos.")
      .transform((value) => value.toUpperCase())
      .refine((value) => SKU_PATTERN.test(value), {
        message: "Usa letras, números, punto, guion o guion bajo.",
      }),
    brandId: z.uuid("Selecciona una marca válida."),
    categoryId: z.uuid("Selecciona una categoría válida."),
    shortDescription: optionalText(500),
    description: optionalText(10_000),
    condition: z.enum(["new", "used"]),
    conditionGrade: z.enum([
      "",
      "like_new",
      "excellent",
      "very_good",
      "good",
      "fair",
    ]),
    conditionNotes: optionalText(2_000),
    fulfillmentType: z.enum(["in_stock", "special_order", "preorder"]),
    price: z.string().trim().min(1, "El precio es obligatorio."),
    compareAtPrice: z.string().trim(),
    currency: z.literal("MXN"),
    priceIsEstimate: z.boolean(),
    leadTimeMinDays: optionalIntegerText,
    leadTimeMaxDays: optionalIntegerText,
    featured: z.boolean(),
    published: z.boolean(),
  })
  .superRefine((values, context) => {
    const price = parseMoneyToMinorUnits(values.price);
    const compareAtPrice =
      values.compareAtPrice === ""
        ? null
        : parseMoneyToMinorUnits(values.compareAtPrice);

    if (price === null) {
      context.addIssue({
        code: "custom",
        path: ["price"],
        message: "Escribe un importe válido con máximo dos decimales.",
      });
    }

    if (values.compareAtPrice !== "" && compareAtPrice === null) {
      context.addIssue({
        code: "custom",
        path: ["compareAtPrice"],
        message: "Escribe un importe válido con máximo dos decimales.",
      });
    } else if (
      price !== null &&
      compareAtPrice !== null &&
      compareAtPrice < price
    ) {
      context.addIssue({
        code: "custom",
        path: ["compareAtPrice"],
        message: "El precio comparativo no puede ser menor que el precio.",
      });
    }

    if (values.condition === "used") {
      if (!values.conditionGrade) {
        context.addIssue({
          code: "custom",
          path: ["conditionGrade"],
          message: "Selecciona el grado del producto seminuevo.",
        });
      }
      if (!values.conditionNotes) {
        context.addIssue({
          code: "custom",
          path: ["conditionNotes"],
          message: "Describe la condición del producto seminuevo.",
        });
      }
    } else if (values.conditionGrade) {
      context.addIssue({
        code: "custom",
        path: ["conditionGrade"],
        message: "Un producto nuevo no lleva grado de condición.",
      });
    }

    const minimum =
      values.leadTimeMinDays === "" ? null : Number(values.leadTimeMinDays);
    const maximum =
      values.leadTimeMaxDays === "" ? null : Number(values.leadTimeMaxDays);

    if ((minimum === null) !== (maximum === null)) {
      context.addIssue({
        code: "custom",
        path: [minimum === null ? "leadTimeMinDays" : "leadTimeMaxDays"],
        message: "Completa ambos extremos del plazo.",
      });
    } else if (minimum !== null && maximum !== null && maximum < minimum) {
      context.addIssue({
        code: "custom",
        path: ["leadTimeMaxDays"],
        message: "El plazo máximo no puede ser menor que el mínimo.",
      });
    }

    if (
      values.fulfillmentType !== "in_stock" &&
      minimum === null &&
      !values.description
    ) {
      context.addIssue({
        code: "custom",
        path: ["leadTimeMinDays"],
        message:
          "Indica un plazo o explica la disponibilidad en la descripción.",
      });
    }

    if (values.published && !values.shortDescription) {
      context.addIssue({
        code: "custom",
        path: ["shortDescription"],
        message: "Agrega una descripción corta antes de publicar.",
      });
    }

    if (values.published && !values.description) {
      context.addIssue({
        code: "custom",
        path: ["description"],
        message: "Agrega una descripción antes de publicar.",
      });
    }
  });

export type ProductFormValues = z.input<typeof productFormSchema>;
export type ValidatedProductFormValues = z.output<typeof productFormSchema>;

export type ProductMutationInput = {
  name: string;
  slug: string;
  sku: string;
  brandId: string;
  categoryId: string;
  shortDescription: string | null;
  description: string | null;
  condition: "new" | "used";
  conditionGrade:
    "like_new" | "excellent" | "very_good" | "good" | "fair" | null;
  conditionNotes: string | null;
  fulfillmentType: "in_stock" | "special_order" | "preorder";
  price: number;
  compareAtPrice: number | null;
  currency: "MXN";
  priceIsEstimate: boolean;
  leadTimeMinDays: number | null;
  leadTimeMaxDays: number | null;
  featured: boolean;
  published: boolean;
};

export type ProductValidationResult =
  | { success: true; data: ProductMutationInput }
  | {
      success: false;
      errors: Record<string, string[] | undefined>;
    };

export function generateProductSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160)
    .replace(/-+$/g, "");
}

export function isValidProductSlug(slug: string): boolean {
  return slug.length <= 160 && SLUG_PATTERN.test(slug);
}

export function parseMoneyToMinorUnits(value: string): number | null {
  const normalized = value.trim();
  const match = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(normalized);

  if (!match) {
    return null;
  }

  const whole = Number(match[1]);
  const fraction = (match[2] ?? "").padEnd(2, "0");
  const amount = whole * 100 + Number(fraction);

  return Number.isSafeInteger(amount) && amount <= MAX_MINOR_UNITS
    ? amount
    : null;
}

export function minorUnitsToPriceInput(value: number | null): string {
  if (value === null) {
    return "";
  }

  return (value / 100).toFixed(2);
}

export function validateProductForm(
  values: ProductFormValues,
): ProductValidationResult {
  const parsed = productFormSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const slug = parsed.data.slug || generateProductSlug(parsed.data.name);
  if (!slug || !isValidProductSlug(slug)) {
    return {
      success: false,
      errors: {
        slug: [
          "No fue posible generar un slug válido. Escribe uno manualmente.",
        ],
      },
    };
  }

  const price = parseMoneyToMinorUnits(parsed.data.price);
  const compareAtPrice =
    parsed.data.compareAtPrice === ""
      ? null
      : parseMoneyToMinorUnits(parsed.data.compareAtPrice);

  if (
    price === null ||
    (parsed.data.compareAtPrice && compareAtPrice === null)
  ) {
    return {
      success: false,
      errors: { price: ["El precio no es válido."] },
    };
  }

  return {
    success: true,
    data: {
      name: parsed.data.name,
      slug,
      sku: parsed.data.sku,
      brandId: parsed.data.brandId,
      categoryId: parsed.data.categoryId,
      shortDescription: parsed.data.shortDescription || null,
      description: parsed.data.description || null,
      condition: parsed.data.condition,
      conditionGrade:
        parsed.data.condition === "used" && parsed.data.conditionGrade
          ? parsed.data.conditionGrade
          : null,
      conditionNotes:
        parsed.data.condition === "used"
          ? parsed.data.conditionNotes || null
          : null,
      fulfillmentType: parsed.data.fulfillmentType,
      price,
      compareAtPrice,
      currency: "MXN",
      priceIsEstimate: parsed.data.priceIsEstimate,
      leadTimeMinDays:
        parsed.data.leadTimeMinDays === ""
          ? null
          : Number(parsed.data.leadTimeMinDays),
      leadTimeMaxDays:
        parsed.data.leadTimeMaxDays === ""
          ? null
          : Number(parsed.data.leadTimeMaxDays),
      featured: parsed.data.featured,
      published: parsed.data.published,
    },
  };
}
