"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";

import { CatalogFeedback } from "@/components/operations/catalog-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TaxonomyActionResult } from "@/lib/catalog/catalog-action-state";
import {
  createBrandAction,
  createCategoryAction,
  updateBrandAction,
  updateCategoryAction,
} from "@/lib/catalog/taxonomy-actions";
import {
  brandFormSchema,
  categoryFormSchema,
  generateTaxonomySlug,
  type BrandFormValues,
  type CategoryFormValues,
} from "@/lib/catalog/taxonomy-validation";

const selectClassName =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50";
const textareaClassName =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 min-h-28 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50";

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}

export function BrandForm({
  mode,
  brandId,
  defaultValues,
}: {
  mode: "create" | "edit";
  brandId?: string;
  defaultValues: BrandFormValues;
}) {
  const [result, setResult] = useState<TaxonomyActionResult>({
    status: "idle",
  });
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<BrandFormValues>({
    resolver: zodResolver(brandFormSchema),
    defaultValues,
  });
  const name = useWatch({ control, name: "name" });
  const fieldError = (field: keyof BrandFormValues) =>
    errors[field]?.message ?? result.errors?.[field]?.[0];

  function submit(values: BrandFormValues) {
    startTransition(async () => {
      setResult(
        mode === "create"
          ? await createBrandAction(values)
          : brandId
            ? await updateBrandAction(brandId, values)
            : { status: "error", message: "La marca solicitada no es válida." },
      );
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-6" noValidate>
      {result.message ? (
        <CatalogFeedback
          tone={result.status === "success" ? "success" : "error"}
          message={result.message}
        />
      ) : null}
      <fieldset
        disabled={pending}
        className="space-y-5 rounded-xl border bg-white p-5 sm:p-6"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="name" label="Nombre" error={fieldError("name")}>
            <Input id="name" {...register("name")} />
          </Field>
          <Field id="slug" label="Slug" error={fieldError("slug")}>
            <div className="flex gap-2">
              <Input id="slug" {...register("slug")} />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setValue("slug", generateTaxonomySlug(name), {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                Generar
              </Button>
            </div>
          </Field>
        </div>
        <Field
          id="description"
          label="Descripción"
          error={fieldError("description")}
        >
          <textarea
            id="description"
            rows={5}
            className={textareaClassName}
            {...register("description")}
          />
        </Field>
        {mode === "create" ? (
          <Field
            id="status"
            label="Estado inicial"
            error={fieldError("status")}
          >
            <select
              id="status"
              className={selectClassName}
              {...register("status")}
            >
              <option value="active">Activa</option>
              <option value="archived">Archivada</option>
            </select>
          </Field>
        ) : null}
        <Button type="submit" size="lg" disabled={pending}>
          {pending
            ? "Guardando…"
            : mode === "create"
              ? "Crear marca"
              : "Guardar cambios"}
        </Button>
      </fieldset>
    </form>
  );
}

export type CategoryParentOption = { id: string; displayName: string };

export function CategoryForm({
  mode,
  categoryId,
  defaultValues,
  parentOptions,
  disabled = false,
}: {
  mode: "create" | "edit";
  categoryId?: string;
  defaultValues: CategoryFormValues;
  parentOptions: CategoryParentOption[];
  disabled?: boolean;
}) {
  const [result, setResult] = useState<TaxonomyActionResult>({
    status: "idle",
  });
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues,
  });
  const name = useWatch({ control, name: "name" });
  const fieldError = (field: keyof CategoryFormValues) =>
    errors[field]?.message ?? result.errors?.[field]?.[0];

  function submit(values: CategoryFormValues) {
    startTransition(async () => {
      setResult(
        mode === "create"
          ? await createCategoryAction(values)
          : categoryId
            ? await updateCategoryAction(categoryId, values)
            : {
                status: "error",
                message: "La categoría solicitada no es válida.",
              },
      );
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-6" noValidate>
      {result.message ? (
        <CatalogFeedback
          tone={result.status === "success" ? "success" : "error"}
          message={result.message}
        />
      ) : null}
      <fieldset
        disabled={pending || disabled}
        className="space-y-5 rounded-xl border bg-white p-5 sm:p-6"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="name" label="Nombre" error={fieldError("name")}>
            <Input id="name" {...register("name")} />
          </Field>
          <Field id="slug" label="Slug" error={fieldError("slug")}>
            <div className="flex gap-2">
              <Input id="slug" {...register("slug")} />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setValue("slug", generateTaxonomySlug(name), {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                Generar
              </Button>
            </div>
          </Field>
          <Field
            id="parentId"
            label="Categoría padre"
            error={fieldError("parentId")}
          >
            <select
              id="parentId"
              className={selectClassName}
              {...register("parentId")}
            >
              <option value="">Sin categoría padre</option>
              {parentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.displayName}
                </option>
              ))}
            </select>
          </Field>
          <Field id="sortOrder" label="Orden" error={fieldError("sortOrder")}>
            <Input
              id="sortOrder"
              type="number"
              min={0}
              step={1}
              {...register("sortOrder")}
            />
          </Field>
        </div>
        <Field
          id="description"
          label="Descripción"
          error={fieldError("description")}
        >
          <textarea
            id="description"
            rows={5}
            className={textareaClassName}
            {...register("description")}
          />
        </Field>
        {mode === "create" ? (
          <Field
            id="status"
            label="Estado inicial"
            error={fieldError("status")}
          >
            <select
              id="status"
              className={selectClassName}
              {...register("status")}
            >
              <option value="active">Activa</option>
              <option value="archived">Archivada</option>
            </select>
          </Field>
        ) : null}
        <Button type="submit" size="lg" disabled={pending || disabled}>
          {pending
            ? "Guardando…"
            : mode === "create"
              ? "Crear categoría"
              : "Guardar cambios"}
        </Button>
      </fieldset>
    </form>
  );
}
