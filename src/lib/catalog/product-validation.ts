import { z } from "zod";

const MAX_MINOR_UNITS = 99_999_999_999_999;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._-]*$/;

export const golfClubTypes = [
  "driver",
  "fairway_wood",
  "hybrid",
  "iron",
  "wedge",
  "putter",
] as const;
export const golfBagTypes = [
  "cart_bag",
  "stand_bag",
  "tour_bag",
  "pencil_bag",
  "travel_bag",
] as const;
export const golfSetTypes = [
  "complete_set",
  "iron_set",
  "starter_set",
  "junior_set",
] as const;
export const handednessValues = ["", "right", "left"] as const;
export const shaftMaterialValues = ["", "graphite", "steel", "other"] as const;
export const shaftFlexValues = [
  "",
  "ladies",
  "senior",
  "regular",
  "stiff",
  "x_stiff",
  "other",
] as const;
export const conditionGradeValues = [
  "",
  "like_new",
  "excellent",
  "very_good",
  "good",
  "fair",
] as const;

const optionalText = (maximum: number) =>
  z.string().trim().max(maximum, `Usa ${maximum} caracteres o menos.`);

const optionalIntegerText = (maximum = 3650) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d+$/.test(value), {
      message: "Escribe un número entero no negativo.",
    })
    .refine((value) => value === "" || Number(value) <= maximum, {
      message: `El valor no puede superar ${maximum}.`,
    });

const optionalDecimalText = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d+(?:\.\d{1,2})?$/.test(value), {
    message: "Escribe un número positivo con máximo dos decimales.",
  });

const triState = z.enum(["", "yes", "no"]);
const componentSchema = z.object({
  componentKind: z.enum(["club", "bag"]),
  quantity: z.string().trim().regex(/^\d+$/, "Escribe una cantidad válida."),
  clubType: z.enum(["", ...golfClubTypes]),
  bagType: z.enum(["", ...golfBagTypes]),
  componentNumber: optionalText(40),
  loftDegrees: optionalDecimalText,
  handedness: z.enum(handednessValues),
  shaftFlex: z.enum(shaftFlexValues),
  shaftMaterial: z.enum(shaftMaterialValues),
  brand: optionalText(120),
  model: optionalText(160),
  condition: z.enum(["", "new", "used"]),
  conditionGrade: z.enum(conditionGradeValues),
});

export const productFormSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre es obligatorio.").max(200),
    slug: z
      .string()
      .trim()
      .max(160)
      .refine((value) => value === "" || SLUG_PATTERN.test(value), {
        message: "Usa sólo minúsculas, números y guiones.",
      }),
    sku: z
      .string()
      .trim()
      .min(1, "El SKU es obligatorio.")
      .max(80)
      .transform((value) => value.toUpperCase())
      .refine((value) => SKU_PATTERN.test(value), {
        message: "Usa letras, números, punto, guion o guion bajo.",
      }),
    brandId: z.uuid("Selecciona una marca válida."),
    categoryId: z.uuid("Selecciona una categoría válida."),
    productFamily: z.enum(["", "club", "bag", "set"]),
    shortDescription: optionalText(500),
    description: optionalText(10_000),
    condition: z.enum(["new", "used"]),
    conditionGrade: z.enum(conditionGradeValues),
    conditionScore: optionalIntegerText(10),
    conditionNotes: optionalText(2_000),
    targetPlayer: z.enum(["", "men", "women", "junior", "unisex"]),
    fulfillmentType: z.enum(["in_stock", "special_order", "preorder"]),
    price: z.string().trim().min(1, "El precio es obligatorio."),
    compareAtPrice: z.string().trim(),
    currency: z.literal("MXN"),
    priceIsEstimate: z.boolean(),
    leadTimeMinDays: optionalIntegerText(),
    leadTimeMaxDays: optionalIntegerText(),
    featured: z.boolean(),
    published: z.boolean(),

    clubType: z.enum(["", ...golfClubTypes]),
    bagType: z.enum(["", ...golfBagTypes]),
    setType: z.enum(["", ...golfSetTypes]),
    model: optionalText(160),
    modelYear: optionalIntegerText(2200),
    handedness: z.enum(handednessValues),
    shaftMaterial: z.enum(shaftMaterialValues),
    shaftBrand: optionalText(120),
    shaftModel: optionalText(160),
    shaftFlex: z.enum(shaftFlexValues),
    shaftWeightGrams: optionalDecimalText,
    clubLengthInches: optionalDecimalText,
    gripBrand: optionalText(120),
    gripModel: optionalText(160),
    gripCondition: optionalText(120),
    headcoverIncluded: triState,
    specificationNotes: optionalText(2_000),
    loftDegrees: optionalDecimalText,
    adjustableLoft: triState,
    adjustableHosel: triState,
    adjustmentToolIncluded: triState,
    clubNumber: optionalText(40),
    ironNumber: optionalText(40),
    bounceDegrees: optionalDecimalText,
    grind: optionalText(120),
    putterHeadType: z.enum(["", "blade", "mallet"]),
    lengthInches: optionalDecimalText,
    lieDegrees: optionalDecimalText,
    neckType: optionalText(120),
    color: optionalText(120),
    dividerCount: optionalIntegerText(100),
    pocketCount: optionalIntegerText(100),
    weightKg: optionalDecimalText,
    rainHoodIncluded: triState,
    strapIncluded: triState,
    waterproof: triState,
    cartCompatible: triState,
    components: z.array(componentSchema).max(30),
  })
  .superRefine((values, context) => {
    const price = parseMoneyToMinorUnits(values.price);
    const compareAtPrice = values.compareAtPrice
      ? parseMoneyToMinorUnits(values.compareAtPrice)
      : null;
    if (price === null) {
      context.addIssue({
        code: "custom",
        path: ["price"],
        message: "Escribe un importe válido con máximo dos decimales.",
      });
    }
    if (values.compareAtPrice && compareAtPrice === null) {
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
      if (!values.conditionGrade)
        context.addIssue({
          code: "custom",
          path: ["conditionGrade"],
          message: "Selecciona el grado del producto seminuevo.",
        });
      if (!values.conditionNotes)
        context.addIssue({
          code: "custom",
          path: ["conditionNotes"],
          message: "Describe la condición del producto seminuevo.",
        });
      if (values.conditionScore && Number(values.conditionScore) < 1)
        context.addIssue({
          code: "custom",
          path: ["conditionScore"],
          message: "La calificación debe estar entre 1 y 10.",
        });
    } else {
      if (values.conditionGrade)
        context.addIssue({
          code: "custom",
          path: ["conditionGrade"],
          message: "Un producto nuevo no lleva grado de condición.",
        });
      if (values.conditionScore)
        context.addIssue({
          code: "custom",
          path: ["conditionScore"],
          message: "Un producto nuevo no lleva calificación de condición.",
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
    if (values.published && !values.shortDescription)
      context.addIssue({
        code: "custom",
        path: ["shortDescription"],
        message: "Agrega una descripción corta antes de publicar.",
      });
    if (values.published && !values.description)
      context.addIssue({
        code: "custom",
        path: ["description"],
        message: "Agrega una descripción antes de publicar.",
      });

    if (values.productFamily === "club" && !values.clubType)
      context.addIssue({
        code: "custom",
        path: ["clubType"],
        message: "Selecciona el tipo de bastón.",
      });
    if (values.productFamily === "bag" && !values.bagType)
      context.addIssue({
        code: "custom",
        path: ["bagType"],
        message: "Selecciona el tipo de bolsa.",
      });
    if (values.productFamily === "set") {
      if (!values.setType)
        context.addIssue({
          code: "custom",
          path: ["setType"],
          message: "Selecciona el tipo de set.",
        });
      if (values.components.length === 0)
        context.addIssue({
          code: "custom",
          path: ["components"],
          message: "Agrega al menos un componente al set.",
        });
      values.components.forEach((component, index) => {
        if (component.componentKind === "club" && !component.clubType)
          context.addIssue({
            code: "custom",
            path: ["components", index, "clubType"],
            message: "Selecciona el tipo de bastón.",
          });
        if (component.componentKind === "bag" && !component.bagType)
          context.addIssue({
            code: "custom",
            path: ["components", index, "bagType"],
            message: "Selecciona el tipo de bolsa.",
          });
      });
    }
  });

export type ProductFormValues = z.input<typeof productFormSchema>;
type GolfSpecifications = Record<string, string | number | boolean | null>;
type GolfComponent = Record<string, string | number | null>;

export type ProductMutationInput = {
  name: string;
  slug: string;
  sku: string;
  brandId: string;
  categoryId: string;
  productFamily: "" | "club" | "bag" | "set";
  shortDescription: string | null;
  description: string | null;
  condition: "new" | "used";
  conditionGrade:
    "like_new" | "excellent" | "very_good" | "good" | "fair" | null;
  conditionScore: number | null;
  conditionNotes: string | null;
  targetPlayer: "men" | "women" | "junior" | "unisex" | null;
  fulfillmentType: "in_stock" | "special_order" | "preorder";
  price: number;
  compareAtPrice: number | null;
  currency: "MXN";
  priceIsEstimate: boolean;
  leadTimeMinDays: number | null;
  leadTimeMaxDays: number | null;
  featured: boolean;
  published: boolean;
  specifications: GolfSpecifications | null;
  components: GolfComponent[];
};

export type ProductValidationResult =
  | { success: true; data: ProductMutationInput }
  | { success: false; errors: Record<string, string[] | undefined> };

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
  const match = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const amount =
    Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount <= MAX_MINOR_UNITS
    ? amount
    : null;
}

export function minorUnitsToPriceInput(value: number | null): string {
  return value === null ? "" : (value / 100).toFixed(2);
}

const boolOrNull = (value: "" | "yes" | "no") =>
  value === "" ? null : value === "yes";
const numberOrNull = (value: string) => (value === "" ? null : Number(value));

export function validateProductForm(
  values: ProductFormValues,
): ProductValidationResult {
  const parsed = productFormSchema.safeParse(values);
  if (!parsed.success)
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  const data = parsed.data;
  const slug = data.slug || generateProductSlug(data.name);
  if (!slug || !isValidProductSlug(slug))
    return {
      success: false,
      errors: {
        slug: [
          "No fue posible generar un slug válido. Escribe uno manualmente.",
        ],
      },
    };
  const price = parseMoneyToMinorUnits(data.price);
  const compareAtPrice = data.compareAtPrice
    ? parseMoneyToMinorUnits(data.compareAtPrice)
    : null;
  if (price === null || (data.compareAtPrice && compareAtPrice === null))
    return { success: false, errors: { price: ["El precio no es válido."] } };

  let specifications: GolfSpecifications | null = null;
  const common = {
    model: data.model || null,
    modelYear: numberOrNull(data.modelYear),
    notes: data.specificationNotes || null,
  };
  if (data.productFamily === "club")
    specifications = {
      ...common,
      clubType: data.clubType,
      handedness: data.handedness || null,
      shaftMaterial: data.shaftMaterial || null,
      shaftBrand: data.shaftBrand || null,
      shaftModel: data.shaftModel || null,
      shaftFlex: data.shaftFlex || null,
      shaftWeightGrams: numberOrNull(data.shaftWeightGrams),
      clubLengthInches: numberOrNull(data.clubLengthInches),
      gripBrand: data.gripBrand || null,
      gripModel: data.gripModel || null,
      gripCondition: data.gripCondition || null,
      headcoverIncluded: boolOrNull(data.headcoverIncluded),
      loftDegrees: numberOrNull(data.loftDegrees),
      adjustableLoft: boolOrNull(data.adjustableLoft),
      adjustableHosel: boolOrNull(data.adjustableHosel),
      adjustmentToolIncluded: boolOrNull(data.adjustmentToolIncluded),
      clubNumber: data.clubNumber || null,
      ironNumber: data.ironNumber || null,
      bounceDegrees: numberOrNull(data.bounceDegrees),
      grind: data.grind || null,
      putterHeadType: data.putterHeadType || null,
      lengthInches: numberOrNull(data.lengthInches),
      lieDegrees: numberOrNull(data.lieDegrees),
      neckType: data.neckType || null,
    };
  if (data.productFamily === "bag")
    specifications = {
      ...common,
      bagType: data.bagType,
      color: data.color || null,
      dividerCount: numberOrNull(data.dividerCount),
      pocketCount: numberOrNull(data.pocketCount),
      weightKg: numberOrNull(data.weightKg),
      rainHoodIncluded: boolOrNull(data.rainHoodIncluded),
      strapIncluded: boolOrNull(data.strapIncluded),
      waterproof: boolOrNull(data.waterproof),
      cartCompatible: boolOrNull(data.cartCompatible),
    };
  if (data.productFamily === "set")
    specifications = {
      ...common,
      setType: data.setType,
      handedness: data.handedness || null,
      shaftMaterial: data.shaftMaterial || null,
      shaftFlex: data.shaftFlex || null,
    };

  return {
    success: true,
    data: {
      name: data.name,
      slug,
      sku: data.sku,
      brandId: data.brandId,
      categoryId: data.categoryId,
      productFamily: data.productFamily,
      shortDescription: data.shortDescription || null,
      description: data.description || null,
      condition: data.condition,
      conditionGrade:
        data.condition === "used" && data.conditionGrade
          ? data.conditionGrade
          : null,
      conditionScore:
        data.condition === "used" ? numberOrNull(data.conditionScore) : null,
      conditionNotes:
        data.condition === "used" ? data.conditionNotes || null : null,
      targetPlayer: data.targetPlayer || null,
      fulfillmentType: data.fulfillmentType,
      price,
      compareAtPrice,
      currency: "MXN",
      priceIsEstimate: data.priceIsEstimate,
      leadTimeMinDays: numberOrNull(data.leadTimeMinDays),
      leadTimeMaxDays: numberOrNull(data.leadTimeMaxDays),
      featured: data.featured,
      published: data.published,
      specifications,
      components:
        data.productFamily === "set"
          ? data.components.map((component) => ({
              componentKind: component.componentKind,
              quantity: Number(component.quantity),
              clubType:
                component.componentKind === "club"
                  ? component.clubType || null
                  : null,
              bagType:
                component.componentKind === "bag"
                  ? component.bagType || null
                  : null,
              componentNumber:
                component.componentKind === "club"
                  ? component.componentNumber || null
                  : null,
              loftDegrees:
                component.componentKind === "club"
                  ? numberOrNull(component.loftDegrees)
                  : null,
              handedness:
                component.componentKind === "club"
                  ? component.handedness || null
                  : null,
              shaftFlex:
                component.componentKind === "club"
                  ? component.shaftFlex || null
                  : null,
              shaftMaterial:
                component.componentKind === "club"
                  ? component.shaftMaterial || null
                  : null,
              brand: component.brand || null,
              model: component.model || null,
              condition: component.condition || null,
              conditionGrade:
                component.condition === "used" && component.conditionGrade
                  ? component.conditionGrade
                  : null,
            }))
          : [],
    },
  };
}
