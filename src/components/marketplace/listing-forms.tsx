"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import {
  ActionFeedback,
  SubmitButton,
} from "@/components/marketplace/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createMarketplaceListingAction,
  removeListingImageAction,
  reorderListingImagesAction,
  resolveListingProductAction,
  saveListingConditionAction,
  saveListingIdentityAction,
  saveListingInventoryAction,
  saveListingSpecsAction,
  submitMarketplaceListingAction,
  transitionListingReviewAction,
  uploadListingImageAction,
} from "@/lib/marketplace/listing-actions";
import { initialPartnerActionState } from "@/lib/marketplace/partner-action-state";
import {
  conditionGradeCopy,
  reviewAreaCopy,
  type CategoryProfile,
  type SpecField,
} from "@/lib/marketplace/listing-rules";

const fieldClass =
  "border-input min-h-11 w-full rounded-xl border bg-white px-3 py-2 text-sm";

function HiddenListingIdentity({
  listingId,
  lockVersion,
}: {
  listingId: string;
  lockVersion: number;
}) {
  return (
    <>
      <input type="hidden" name="listing_id" value={listingId} />
      <input type="hidden" name="lock_version" value={lockVersion} />
    </>
  );
}

export function CreateListingForm({
  categories,
}: {
  categories: Array<{ id: string; name: string }>;
}) {
  const [state, action] = useActionState(
    createMarketplaceListingAction,
    initialPartnerActionState,
  );
  return (
    <form action={action} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="category_id">Categoría</Label>
        <select
          id="category_id"
          name="category_id"
          required
          className={fieldClass}
        >
          <option value="">Selecciona una categoría</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      <ActionFeedback state={state} />
      <SubmitButton>Crear borrador</SubmitButton>
    </form>
  );
}

export function ListingIdentityForm({
  listingId,
  lockVersion,
  values,
  brands,
  models,
}: {
  listingId: string;
  lockVersion: number;
  values: {
    canonical_model_id: string | null;
    brand_id: string | null;
    proposed_brand: string | null;
    proposed_model: string | null;
    title: string | null;
    description: string | null;
  };
  brands: Array<{ id: string; name: string }>;
  models: Array<{ id: string; brand_id: string; model_name: string }>;
}) {
  const [state, action] = useActionState(
    saveListingIdentityAction,
    initialPartnerActionState,
  );
  const [brandId, setBrandId] = useState(values.brand_id ?? "");
  const visibleModels = useMemo(
    () => models.filter((model) => !brandId || model.brand_id === brandId),
    [brandId, models],
  );
  return (
    <form action={action} className="space-y-6">
      <HiddenListingIdentity listingId={listingId} lockVersion={lockVersion} />
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="brand_id">Marca existente</Label>
          <select
            id="brand_id"
            name="brand_id"
            className={fieldClass}
            value={brandId}
            onChange={(event) => setBrandId(event.target.value)}
          >
            <option value="">No aparece / por confirmar</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="canonical_model_id">Modelo existente</Label>
          <select
            id="canonical_model_id"
            name="canonical_model_id"
            defaultValue={values.canonical_model_id ?? ""}
            className={fieldClass}
          >
            <option value="">No encuentro mi producto</option>
            {visibleModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.model_name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="proposed_brand">Proponer marca</Label>
          <Input
            id="proposed_brand"
            name="proposed_brand"
            defaultValue={values.proposed_brand ?? ""}
            maxLength={120}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="proposed_model">Proponer modelo</Label>
          <Input
            id="proposed_model"
            name="proposed_model"
            defaultValue={values.proposed_model ?? ""}
            maxLength={160}
          />
        </div>
      </div>
      <p className="text-muted-foreground text-sm">
        Si no encuentras tu producto, Best Round resolverá la propuesta antes de
        aprobar.
      </p>
      <div className="space-y-2">
        <Label htmlFor="title">Título sugerido</Label>
        <Input
          id="title"
          name="title"
          defaultValue={values.title ?? ""}
          required
          minLength={3}
          maxLength={180}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
        <textarea
          id="description"
          name="description"
          defaultValue={values.description ?? ""}
          required
          minLength={3}
          maxLength={4000}
          rows={6}
          className={fieldClass}
        />
        <p className="text-muted-foreground text-xs">
          Texto simple; no se admite HTML.
        </p>
      </div>
      <ActionFeedback state={state} />
      <SubmitButton>Guardar y continuar</SubmitButton>
    </form>
  );
}

export function ListingPhotosForm({
  listingId,
  lockVersion,
  requirements,
  images,
}: {
  listingId: string;
  lockVersion: number;
  requirements: Array<{
    image_type: string;
    requirement: "REQUIRED" | "RECOMMENDED" | "OPTIONAL";
    label: string;
  }>;
  images: Array<{
    image_id: string;
    image_type: string;
    requirement: string;
    alt_text: string;
    sort_order: number;
    signedUrl?: string;
  }>;
}) {
  const [uploadState, uploadAction] = useActionState(
    uploadListingImageAction,
    initialPartnerActionState,
  );
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((image, index) => (
          <article
            key={image.image_id}
            className="overflow-hidden rounded-xl border bg-white"
          >
            {image.signedUrl ? (
              <div className="relative aspect-[4/3] bg-black/5">
                <Image
                  src={image.signedUrl}
                  alt={image.alt_text}
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-contain"
                />
              </div>
            ) : null}
            <div className="space-y-3 p-4">
              <p className="font-medium capitalize">
                {image.image_type.replaceAll("_", " ")}
              </p>
              <RemoveListingImageForm
                listingId={listingId}
                lockVersion={lockVersion}
                imageId={image.image_id}
              />
              <div className="flex gap-2">
                {index > 0 ? (
                  <ReorderListingImagesForm
                    listingId={listingId}
                    lockVersion={lockVersion}
                    imageIds={moveImage(images, index, index - 1)}
                    label="Mover antes"
                  />
                ) : null}
                {index < images.length - 1 ? (
                  <ReorderListingImagesForm
                    listingId={listingId}
                    lockVersion={lockVersion}
                    imageIds={moveImage(images, index, index + 1)}
                    label="Mover después"
                  />
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
      <form
        action={uploadAction}
        className="space-y-5 rounded-xl border bg-white p-5"
      >
        <HiddenListingIdentity
          listingId={listingId}
          lockVersion={lockVersion}
        />
        <div className="space-y-2">
          <Label htmlFor="image_type">Vista de la foto</Label>
          <select
            id="image_type"
            name="image_type"
            className={fieldClass}
            required
          >
            <option value="">Selecciona una vista</option>
            {requirements.map((requirement) => (
              <option
                key={`${requirement.image_type}-${requirement.requirement}`}
                value={requirement.image_type}
              >
                {requirement.label} ·{" "}
                {requirement.requirement === "REQUIRED"
                  ? "Requerida"
                  : requirement.requirement === "RECOMMENDED"
                    ? "Recomendada"
                    : "Opcional"}
              </option>
            ))}
            <option value="other">Otra vista · Opcional</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="listing-image">Foto</Label>
          <Input
            id="listing-image"
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            required
          />
          <p className="text-muted-foreground text-xs">
            JPEG, PNG o WebP. Máximo 10 MiB.
          </p>
        </div>
        <ActionFeedback state={uploadState} />
        <SubmitButton>Agregar foto</SubmitButton>
      </form>
      <Button asChild variant="outline">
        <Link href={`/partner/publicaciones/${listingId}/detalles`}>
          Continuar a detalles
        </Link>
      </Button>
    </div>
  );
}

function moveImage(
  images: Array<{ image_id: string }>,
  from: number,
  to: number,
) {
  const ordered = images.map((image) => image.image_id);
  const [moved] = ordered.splice(from, 1);
  if (moved) ordered.splice(to, 0, moved);
  return ordered;
}

function ReorderListingImagesForm({
  listingId,
  lockVersion,
  imageIds,
  label,
}: {
  listingId: string;
  lockVersion: number;
  imageIds: string[];
  label: string;
}) {
  const [state, action] = useActionState(
    reorderListingImagesAction,
    initialPartnerActionState,
  );
  return (
    <form action={action} className="space-y-2">
      <HiddenListingIdentity listingId={listingId} lockVersion={lockVersion} />
      <input type="hidden" name="image_ids" value={imageIds.join(",")} />
      <ActionFeedback state={state} />
      <SubmitButton>{label}</SubmitButton>
    </form>
  );
}

function RemoveListingImageForm({
  listingId,
  lockVersion,
  imageId,
}: {
  listingId: string;
  lockVersion: number;
  imageId: string;
}) {
  const [state, action] = useActionState(
    removeListingImageAction,
    initialPartnerActionState,
  );
  return (
    <form action={action} className="space-y-2">
      <HiddenListingIdentity listingId={listingId} lockVersion={lockVersion} />
      <input type="hidden" name="image_id" value={imageId} />
      <ActionFeedback state={state} />
      <SubmitButton>Eliminar</SubmitButton>
    </form>
  );
}

export function ListingSpecsForm({
  listingId,
  lockVersion,
  profile,
  fields,
  values,
}: {
  listingId: string;
  lockVersion: number;
  profile: CategoryProfile | null;
  fields: SpecField[];
  values: Record<string, unknown>;
}) {
  const [state, action] = useActionState(
    saveListingSpecsAction,
    initialPartnerActionState,
  );
  return (
    <form action={action} className="space-y-6">
      <HiddenListingIdentity listingId={listingId} lockVersion={lockVersion} />
      {profile ? (
        <p className="text-muted-foreground text-sm">
          Campos adaptados a {profile.family}.
        </p>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map((field) => (
          <SpecInput key={field.key} field={field} value={values[field.key]} />
        ))}
      </div>
      {!fields.length ? (
        <p className="rounded-xl border border-dashed p-5 text-sm">
          Esta categoría no requiere especificaciones técnicas adicionales.
        </p>
      ) : null}
      <ActionFeedback state={state} />
      <SubmitButton>Guardar y continuar</SubmitButton>
    </form>
  );
}

function SpecInput({ field, value }: { field: SpecField; value: unknown }) {
  const name = `spec_${field.key}`;
  if (field.type === "checkbox") {
    return (
      <label className="flex min-h-11 items-center gap-3 rounded-xl border bg-white p-3">
        <input type="checkbox" name={name} defaultChecked={value === true} />
        <span>{field.label}</span>
      </label>
    );
  }
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {field.label}
        {field.required ? " *" : ""}
      </Label>
      {field.type === "select" ? (
        <select
          id={name}
          name={name}
          defaultValue={typeof value === "string" ? value : ""}
          required={field.required}
          className={fieldClass}
        >
          <option value="">Selecciona</option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : field.type === "textarea" ? (
        <textarea
          id={name}
          name={name}
          defaultValue={
            Array.isArray(value)
              ? value.join(", ")
              : typeof value === "string"
                ? value
                : ""
          }
          required={field.required}
          rows={4}
          className={fieldClass}
        />
      ) : (
        <Input
          id={name}
          name={name}
          type={field.type}
          step={field.type === "number" ? "0.1" : undefined}
          min={field.type === "number" ? "0" : undefined}
          defaultValue={
            typeof value === "string" || typeof value === "number" ? value : ""
          }
          required={field.required}
        />
      )}
    </div>
  );
}

export function ListingConditionForm({
  listingId,
  lockVersion,
  values,
}: {
  listingId: string;
  lockVersion: number;
  values: {
    condition: "new" | "used" | null;
    condition_grade: keyof typeof conditionGradeCopy | null;
    condition_notes: string | null;
    declared_defects: unknown;
    defects_acknowledged: boolean;
  };
}) {
  const [state, action] = useActionState(
    saveListingConditionAction,
    initialPartnerActionState,
  );
  const defects = Array.isArray(values.declared_defects)
    ? values.declared_defects
        .filter((entry): entry is string => typeof entry === "string")
        .join("\n")
    : "";
  return (
    <form action={action} className="space-y-6">
      <HiddenListingIdentity listingId={listingId} lockVersion={lockVersion} />
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="condition">Condición</Label>
          <select
            id="condition"
            name="condition"
            defaultValue={values.condition ?? ""}
            required
            className={fieldClass}
          >
            <option value="">Selecciona</option>
            <option value="new">Nuevo</option>
            <option value="used">Usado</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="condition_grade">Grado si es usado</Label>
          <select
            id="condition_grade"
            name="condition_grade"
            defaultValue={values.condition_grade ?? ""}
            className={fieldClass}
          >
            <option value="">No aplica / selecciona</option>
            {Object.entries(conditionGradeCopy).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="condition_notes">Estado real</Label>
        <textarea
          id="condition_notes"
          name="condition_notes"
          defaultValue={values.condition_notes ?? ""}
          required
          minLength={3}
          maxLength={1000}
          rows={5}
          className={fieldClass}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="declared_defects">Defectos declarados</Label>
        <textarea
          id="declared_defects"
          name="declared_defects"
          defaultValue={defects}
          rows={4}
          className={fieldClass}
          placeholder="Uno por línea. Déjalo vacío si no hay defectos conocidos."
        />
      </div>
      <label className="flex items-start gap-3 rounded-xl border bg-white p-4">
        <input
          type="checkbox"
          name="defects_acknowledged"
          defaultChecked={values.defects_acknowledged}
          required
          className="mt-1"
        />
        <span>He declarado cualquier daño o defecto relevante.</span>
      </label>
      <ActionFeedback state={state} />
      <SubmitButton>Guardar y continuar</SubmitButton>
    </form>
  );
}

export function ListingInventoryForm({
  listingId,
  lockVersion,
  quantity,
  custody,
  fulfillment,
}: {
  listingId: string;
  lockVersion: number;
  quantity: number;
  custody: "PARTNER_CUSTODY" | "BEST_ROUND_CUSTODY";
  fulfillment: "PARTNER_FULFILLED" | "BEST_ROUND_FULFILLED";
}) {
  const [state, action] = useActionState(
    saveListingInventoryAction,
    initialPartnerActionState,
  );
  return (
    <form action={action} className="space-y-6">
      <HiddenListingIdentity listingId={listingId} lockVersion={lockVersion} />
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="quantity">Cantidad disponible</Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            min="1"
            max="100000"
            defaultValue={quantity}
            required
          />
          <p className="text-muted-foreground text-xs">
            Funciona para una pieza única o múltiples unidades.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="custody">Custodia</Label>
          <select
            id="custody"
            name="custody"
            defaultValue={custody}
            className={fieldClass}
          >
            <option value="PARTNER_CUSTODY">La conserva el Partner</option>
            <option value="BEST_ROUND_CUSTODY">Custodia Best Round</option>
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="fulfillment">Preparación futura</Label>
          <select
            id="fulfillment"
            name="fulfillment"
            defaultValue={fulfillment}
            className={fieldClass}
          >
            <option value="PARTNER_FULFILLED">Preparado por Partner</option>
            <option value="BEST_ROUND_FULFILLED">
              Preparado por Best Round
            </option>
          </select>
        </div>
      </div>
      <p className="text-muted-foreground text-sm">
        La propiedad siempre permanece PARTNER_OWNED. Envíos y venta todavía no
        están habilitados.
      </p>
      <ActionFeedback state={state} />
      <SubmitButton>Guardar y continuar</SubmitButton>
    </form>
  );
}

export function SubmitListingForm({
  listingId,
  lockVersion,
  quoteId,
  ready,
}: {
  listingId: string;
  lockVersion: number;
  quoteId: string | null;
  ready: boolean;
}) {
  const [state, action] = useActionState(
    submitMarketplaceListingAction,
    initialPartnerActionState,
  );
  return (
    <form action={action} className="space-y-4">
      <HiddenListingIdentity listingId={listingId} lockVersion={lockVersion} />
      <input type="hidden" name="quote_id" value={quoteId ?? ""} />
      <ActionFeedback state={state} />
      <SubmitButton disabled={!ready || !quoteId}>
        {ready && quoteId
          ? "Enviar para publicación"
          : "Completa los pendientes"}
      </SubmitButton>
    </form>
  );
}

export function ResolveListingProductForm({
  listingId,
  lockVersion,
  brands,
  models,
}: {
  listingId: string;
  lockVersion: number;
  brands: Array<{ id: string; name: string }>;
  models: Array<{
    id: string;
    model_name: string;
    brands: { name: string } | null;
  }>;
}) {
  const [state, action] = useActionState(
    resolveListingProductAction,
    initialPartnerActionState,
  );
  return (
    <form action={action} className="space-y-5">
      <HiddenListingIdentity listingId={listingId} lockVersion={lockVersion} />
      <div className="space-y-2">
        <Label htmlFor="model_id">Vincular modelo existente</Label>
        <select id="model_id" name="model_id" className={fieldClass}>
          <option value="">Crear modelo canónico</option>
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.brands?.name} {model.model_name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="resolve-brand">Marca si se crea</Label>
          <select id="resolve-brand" name="brand_id" className={fieldClass}>
            <option value="">Selecciona</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="model_name">Modelo canónico</Label>
          <Input id="model_name" name="model_name" maxLength={160} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="resolve-reason">Motivo de resolución</Label>
        <Input
          id="resolve-reason"
          name="reason"
          minLength={3}
          maxLength={500}
          required
        />
      </div>
      <ActionFeedback state={state} />
      <SubmitButton>Vincular producto</SubmitButton>
    </form>
  );
}

export function ListingReviewDecisionForm({
  listingId,
  lockVersion,
  options,
}: {
  listingId: string;
  lockVersion: number;
  options: Array<{
    value: "UNDER_REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "REJECTED";
    label: string;
  }>;
}) {
  const [state, action] = useActionState(
    transitionListingReviewAction,
    initialPartnerActionState,
  );
  return (
    <form action={action} className="space-y-5">
      <HiddenListingIdentity listingId={listingId} lockVersion={lockVersion} />
      <input type="hidden" name="consolidated" value="true" />
      <div className="space-y-2">
        <Label htmlFor="review-status">Decisión</Label>
        <select
          id="review-status"
          name="status"
          className={fieldClass}
          required
        >
          <option value="">Selecciona</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
        <input
          type="checkbox"
          name="market_analysis_override"
          className="mt-1"
        />
        <span>
          <strong className="block">
            Aprobar sin análisis automático de mercado
          </strong>
          Marca sólo al aprobar sin datos de mercado. El motivo es obligatorio y
          quedará auditado con tu usuario, email y fecha. Esto no evita ningún
          mínimo financiero.
        </span>
      </label>
      <div className="space-y-2">
        <Label htmlFor="review-area">Área si solicitas cambios</Label>
        <select id="review-area" name="area" className={fieldClass}>
          <option value="">No aplica</option>
          {Object.entries(reviewAreaCopy).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="feedback">Comentario visible al Partner</Label>
        <textarea
          id="feedback"
          name="feedback"
          rows={4}
          maxLength={1000}
          className={fieldClass}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="review-reason">Motivo de la decisión</Label>
        <textarea
          id="review-reason"
          name="reason"
          rows={3}
          minLength={3}
          maxLength={1000}
          required
          className={fieldClass}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="internal_note">Nota interna opcional</Label>
        <textarea
          id="internal_note"
          name="internal_note"
          rows={3}
          maxLength={1000}
          className={fieldClass}
        />
        <p className="text-muted-foreground text-xs">
          Nunca se muestra al Partner.
        </p>
      </div>
      <ActionFeedback state={state} />
      <SubmitButton>Guardar decisión</SubmitButton>
    </form>
  );
}
