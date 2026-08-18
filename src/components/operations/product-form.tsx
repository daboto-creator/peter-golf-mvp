"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  useForm,
  useWatch,
  type UseFormRegisterReturn,
  type UseFormSetValue,
} from "react-hook-form";

import { CatalogFeedback } from "@/components/operations/catalog-feedback";
import { ProductGolfFields } from "@/components/operations/product-golf-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CatalogActionResult } from "@/lib/catalog/catalog-action-state";
import {
  createProductAction,
  updateProductAction,
} from "@/lib/catalog/operational-actions";
import type { CatalogReference } from "@/lib/catalog/operational-products";
import {
  generateProductSlug,
  productFormSchema,
  type ProductFormValues,
} from "@/lib/catalog/product-validation";

const selectClassName =
  "border-input bg-background focus-visible:border-pg-gold h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50";
const textareaClassName =
  "border-input bg-background focus-visible:border-pg-gold min-h-28 w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50";

export function ProductForm({
  mode,
  productId,
  defaultValues,
  brands,
  categories,
  disabled = false,
}: {
  mode: "create" | "edit";
  productId?: string;
  defaultValues: ProductFormValues;
  brands: CatalogReference[];
  categories: CatalogReference[];
  disabled?: boolean;
}) {
  const [result, setResult] = useState<CatalogActionResult>({
    status: "idle",
  });
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues,
  });
  const name = useWatch({ control, name: "name" });
  const condition = useWatch({ control, name: "condition" });
  const categoryId = useWatch({ control, name: "categoryId" });
  const productFamily = useWatch({ control, name: "productFamily" });
  const fulfillmentType = useWatch({ control, name: "fulfillmentType" });
  const previousCategoryId = useRef(categoryId);
  const unavailable =
    disabled || brands.length === 0 || categories.length === 0;

  useEffect(() => {
    if (condition === "new") {
      setValue("conditionGrade", "");
      setValue("conditionNotes", "");
      setValue("conditionScore", "");
    }
  }, [condition, setValue]);

  useEffect(() => {
    const category = categories.find(
      (candidate) => candidate.id === categoryId,
    );
    if (previousCategoryId.current !== categoryId) {
      clearGolfSpecificationValues(setValue);
      previousCategoryId.current = categoryId;
    }
    setValue("productFamily", category?.family ?? "", {
      shouldValidate: true,
    });
    if (category?.clubType) setValue("clubType", category.clubType);
    if (category?.bagType) setValue("bagType", category.bagType);
    if (category?.setType) setValue("setType", category.setType);
  }, [categories, categoryId, setValue]);

  function fieldError(name: keyof ProductFormValues): string | undefined {
    const clientError = errors[name]?.message;
    return typeof clientError === "string"
      ? clientError
      : result.errors?.[name]?.[0];
  }

  function submit(values: ProductFormValues) {
    startTransition(async () => {
      const nextResult =
        mode === "create"
          ? await createProductAction(values)
          : productId
            ? await updateProductAction(productId, values)
            : {
                status: "error" as const,
                message: "El producto solicitado no es válido.",
              };
      setResult(nextResult);
    });
  }

  function generateSlug() {
    setValue("slug", generateProductSlug(name), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-8" noValidate>
      {result.message ? (
        <CatalogFeedback
          tone={result.status === "success" ? "success" : "error"}
          message={result.message}
        />
      ) : null}

      {disabled ? (
        <CatalogFeedback
          tone="info"
          title="Producto archivado"
          message="Restaura el producto para volver a editar sus datos."
        />
      ) : null}

      <fieldset disabled={unavailable || pending} className="space-y-8">
        <section className="space-y-5 rounded-xl border bg-white p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold">Identidad del producto</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Datos visibles y referencias operativas básicas.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              id="name"
              label="Nombre"
              error={fieldError("name")}
              className="sm:col-span-2"
            >
              <Input id="name" {...register("name")} />
            </FormField>
            <FormField id="slug" label="Slug" error={fieldError("slug")}>
              <div className="flex gap-2">
                <Input
                  id="slug"
                  placeholder="se-genera-desde-el-nombre"
                  {...register("slug")}
                />
                <Button type="button" variant="outline" onClick={generateSlug}>
                  Generar
                </Button>
              </div>
            </FormField>
            <FormField id="sku" label="SKU" error={fieldError("sku")}>
              <Input
                id="sku"
                autoCapitalize="characters"
                {...register("sku")}
              />
            </FormField>
            <FormField id="brandId" label="Marca" error={fieldError("brandId")}>
              <select
                id="brandId"
                className={selectClassName}
                {...register("brandId")}
              >
                <option value="">Selecciona una marca</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                    {brand.status === "archived"
                      ? " (archivada · relación actual)"
                      : ""}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              id="categoryId"
              label="Categoría"
              error={fieldError("categoryId")}
            >
              <select
                id="categoryId"
                className={selectClassName}
                {...register("categoryId")}
              >
                <option value="">Selecciona una categoría</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.parentId ? `— ${category.name}` : category.name}
                    {category.status === "archived"
                      ? " (archivada · relación actual)"
                      : ""}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField
            id="shortDescription"
            label="Descripción corta"
            error={fieldError("shortDescription")}
          >
            <textarea
              id="shortDescription"
              className={textareaClassName}
              rows={3}
              {...register("shortDescription")}
            />
          </FormField>
          <FormField
            id="description"
            label="Descripción"
            error={fieldError("description")}
          >
            <textarea
              id="description"
              className={textareaClassName}
              rows={7}
              {...register("description")}
            />
          </FormField>
        </section>

        <section className="space-y-5 rounded-xl border bg-white p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold">Condición</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Los productos seminuevos requieren grado y notas claras.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <FormField
              id="condition"
              label="Condición"
              error={fieldError("condition")}
            >
              <select
                id="condition"
                className={selectClassName}
                {...register("condition")}
              >
                <option value="new">Nuevo</option>
                <option value="used">Seminuevo</option>
              </select>
            </FormField>
            <FormField
              id="conditionScore"
              label="Calificación (1–10)"
              error={fieldError("conditionScore")}
            >
              <Input
                id="conditionScore"
                inputMode="numeric"
                disabled={condition === "new" || unavailable || pending}
                {...register("conditionScore")}
              />
            </FormField>
            <FormField
              id="targetPlayer"
              label="Golfista objetivo"
              error={fieldError("targetPlayer")}
            >
              <select
                id="targetPlayer"
                className={selectClassName}
                {...register("targetPlayer")}
              >
                <option value="">No especificado</option>
                <option value="men">Hombre</option>
                <option value="women">Mujer</option>
                <option value="junior">Junior</option>
                <option value="unisex">Unisex</option>
              </select>
            </FormField>
            <FormField
              id="conditionGrade"
              label="Grado de condición"
              error={fieldError("conditionGrade")}
            >
              <select
                id="conditionGrade"
                className={selectClassName}
                disabled={condition === "new" || unavailable || pending}
                {...register("conditionGrade")}
              >
                <option value="">Selecciona un grado</option>
                <option value="like_new">Como nuevo</option>
                <option value="excellent">Excelente</option>
                <option value="very_good">Muy bueno</option>
                <option value="good">Bueno</option>
                <option value="fair">Con desgaste visible</option>
              </select>
            </FormField>
          </div>
          {condition === "used" ? (
            <FormField
              id="conditionNotes"
              label="Notas de condición"
              error={fieldError("conditionNotes")}
            >
              <textarea
                id="conditionNotes"
                className={textareaClassName}
                rows={4}
                {...register("conditionNotes")}
              />
            </FormField>
          ) : null}
        </section>

        {productFamily ? (
          <ProductGolfFields
            family={productFamily}
            category={categories.find(
              (candidate) => candidate.id === categoryId,
            )}
            register={register}
            control={control}
            fieldError={fieldError}
          />
        ) : null}

        <section className="space-y-5 rounded-xl border bg-white p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold">Precio y disponibilidad</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Los importes se capturan en pesos y se guardan como centavos.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              id="fulfillmentType"
              label="Tipo de fulfillment"
              error={fieldError("fulfillmentType")}
            >
              <select
                id="fulfillmentType"
                className={selectClassName}
                {...register("fulfillmentType")}
              >
                <option value="in_stock">En stock</option>
                <option value="special_order">Sobre pedido</option>
                <option value="preorder">Preventa</option>
              </select>
            </FormField>
            <FormField
              id="price"
              label="Precio (MXN)"
              error={fieldError("price")}
            >
              <Input
                id="price"
                inputMode="decimal"
                placeholder="1250.00"
                {...register("price")}
              />
            </FormField>
            <FormField
              id="compareAtPrice"
              label="Precio comparativo (opcional)"
              error={fieldError("compareAtPrice")}
            >
              <Input
                id="compareAtPrice"
                inputMode="decimal"
                placeholder="1500.00"
                {...register("compareAtPrice")}
              />
            </FormField>
          </div>
          <input type="hidden" value="MXN" {...register("currency")} />
          {fulfillmentType !== "in_stock" ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                id="leadTimeMinDays"
                label="Plazo mínimo (días)"
                error={fieldError("leadTimeMinDays")}
              >
                <Input
                  id="leadTimeMinDays"
                  inputMode="numeric"
                  {...register("leadTimeMinDays")}
                />
              </FormField>
              <FormField
                id="leadTimeMaxDays"
                label="Plazo máximo (días)"
                error={fieldError("leadTimeMaxDays")}
              >
                <Input
                  id="leadTimeMaxDays"
                  inputMode="numeric"
                  {...register("leadTimeMaxDays")}
                />
              </FormField>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-3">
            <CheckboxField
              id="priceIsEstimate"
              label="Precio estimado"
              register={register("priceIsEstimate")}
            />
            <CheckboxField
              id="featured"
              label="Producto destacado"
              register={register("featured")}
            />
            <CheckboxField
              id="published"
              label="Publicar al guardar"
              register={register("published")}
            />
          </div>
        </section>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={unavailable || pending}>
          {pending
            ? "Guardando…"
            : mode === "create"
              ? "Crear producto"
              : "Guardar cambios"}
        </Button>
        <p className="text-muted-foreground text-sm">
          {mode === "create"
            ? "Se creará una variante base con el mismo SKU. Costos e inventario permanecen fuera de este formulario."
            : "Nombre y SKU se sincronizan con la variante base; no se crean variantes ni se modifican costos o inventario."}
        </p>
      </div>
    </form>
  );
}

function clearGolfSpecificationValues(
  setValue: UseFormSetValue<ProductFormValues>,
) {
  const emptyTextFields = [
    "clubType",
    "bagType",
    "setType",
    "model",
    "modelYear",
    "handedness",
    "shaftMaterial",
    "shaftBrand",
    "shaftModel",
    "shaftFlex",
    "shaftWeightGrams",
    "clubLengthInches",
    "gripBrand",
    "gripModel",
    "gripCondition",
    "headcoverIncluded",
    "specificationNotes",
    "loftDegrees",
    "adjustableLoft",
    "adjustableHosel",
    "adjustmentToolIncluded",
    "clubNumber",
    "ironNumber",
    "bounceDegrees",
    "grind",
    "putterHeadType",
    "lengthInches",
    "lieDegrees",
    "neckType",
    "color",
    "dividerCount",
    "pocketCount",
    "weightKg",
    "rainHoodIncluded",
    "strapIncluded",
    "waterproof",
    "cartCompatible",
  ] as const;
  emptyTextFields.forEach((name) => setValue(name, "", { shouldDirty: true }));
  setValue("components", [], { shouldDirty: true });
}

function FormField({
  id,
  label,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="space-y-2">
        <Label htmlFor={id}>{label}</Label>
        {children}
        {error ? (
          <p
            id={`${id}-error`}
            className="text-destructive text-sm"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function CheckboxField({
  id,
  label,
  register,
}: {
  id: string;
  label: string;
  register: UseFormRegisterReturn;
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-center gap-3 rounded-lg border p-3 text-sm font-medium"
    >
      <input
        id={id}
        type="checkbox"
        className="border-input size-4 rounded"
        {...register}
      />
      {label}
    </label>
  );
}
