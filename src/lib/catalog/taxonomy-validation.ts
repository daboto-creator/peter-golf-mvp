import { z } from "zod";

export const catalogRecordStatuses = ["active", "archived"] as const;

const slugSchema = z
  .string()
  .trim()
  .min(1, "Escribe un slug.")
  .max(120, "El slug no puede exceder 120 caracteres.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Usa sólo minúsculas, números y guiones simples.",
  );

const baseTaxonomySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Escribe un nombre.")
    .max(120, "El nombre no puede exceder 120 caracteres."),
  slug: slugSchema,
  description: z
    .string()
    .trim()
    .max(2000, "La descripción no puede exceder 2,000 caracteres."),
  status: z.enum(catalogRecordStatuses, {
    error: "Selecciona un estado válido.",
  }),
});

export const brandFormSchema = baseTaxonomySchema;

export const categoryFormSchema = baseTaxonomySchema.extend({
  parentId: z.union([
    z.literal(""),
    z.uuid("Selecciona una categoría válida."),
  ]),
  sortOrder: z
    .string()
    .trim()
    .regex(/^\d+$/, "El orden debe ser un entero no negativo.")
    .refine(
      (value) => Number(value) <= 1_000_000,
      "El orden no puede exceder 1,000,000.",
    ),
});

export type BrandFormValues = z.input<typeof brandFormSchema>;
export type CategoryFormValues = z.input<typeof categoryFormSchema>;

export type TaxonomyValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: Record<string, string[] | undefined> };

export function validateBrandForm(
  values: unknown,
): TaxonomyValidationResult<z.output<typeof brandFormSchema>> {
  const parsed = brandFormSchema.safeParse(values);
  return parsed.success
    ? { success: true, data: parsed.data }
    : { success: false, errors: parsed.error.flatten().fieldErrors };
}

export function validateCategoryForm(
  values: unknown,
): TaxonomyValidationResult<{
  name: string;
  slug: string;
  description: string;
  status: (typeof catalogRecordStatuses)[number];
  parentId: string | null;
  sortOrder: number;
}> {
  const parsed = categoryFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  return {
    success: true,
    data: {
      ...parsed.data,
      parentId: parsed.data.parentId || null,
      sortOrder: Number(parsed.data.sortOrder),
    },
  };
}

export function generateTaxonomySlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function taxonomySlugConflictMessage(kind: "brand" | "category") {
  return kind === "brand"
    ? "Ya existe una marca con este slug."
    : "Ya existe una categoría con este slug.";
}

export type CategoryParentReference = {
  id: string;
  parentId: string | null;
};

export function wouldCreateCategoryCycle(
  categoryId: string,
  requestedParentId: string | null,
  categories: CategoryParentReference[],
): boolean {
  if (!requestedParentId) return false;
  if (requestedParentId === categoryId) return true;

  const parentById = new Map(
    categories.map((category) => [category.id, category.parentId]),
  );
  const visited = new Set<string>();
  let currentId: string | null = requestedParentId;

  while (currentId) {
    if (currentId === categoryId || visited.has(currentId)) return true;
    visited.add(currentId);
    currentId = parentById.get(currentId) ?? null;
  }

  return false;
}

export type SelectableTaxonomy = {
  id: string;
  name: string;
  status: (typeof catalogRecordStatuses)[number];
};

export function selectAssignableTaxonomies<T extends SelectableTaxonomy>(
  records: T[],
  currentId?: string,
): T[] {
  return records.filter(
    (record) => record.status === "active" || record.id === currentId,
  );
}
