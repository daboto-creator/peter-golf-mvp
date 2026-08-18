"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  useFieldArray,
  useWatch,
  type Control,
  type UseFormRegister,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CatalogReference } from "@/lib/catalog/operational-products";
import type { ProductFormValues } from "@/lib/catalog/product-validation";

const selectClassName =
  "border-input bg-background focus-visible:border-pg-gold h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50";
const textareaClassName =
  "border-input bg-background focus-visible:border-pg-gold min-h-24 w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2";

type Props = {
  family: "club" | "bag" | "set";
  category?: CatalogReference;
  register: UseFormRegister<ProductFormValues>;
  control: Control<ProductFormValues>;
  fieldError: (name: keyof ProductFormValues) => string | undefined;
};

const clubOptions = [
  ["driver", "Driver"],
  ["fairway_wood", "Fairway Wood"],
  ["hybrid", "Hybrid"],
  ["iron", "Iron"],
  ["wedge", "Wedge"],
  ["putter", "Putter"],
] as const;
const bagOptions = [
  ["cart_bag", "Cart Bag"],
  ["stand_bag", "Stand Bag"],
  ["tour_bag", "Tour Bag"],
  ["pencil_bag", "Pencil Bag"],
  ["travel_bag", "Travel Bag"],
] as const;
const setOptions = [
  ["complete_set", "Complete Set"],
  ["iron_set", "Iron Set"],
  ["starter_set", "Starter Set"],
  ["junior_set", "Junior Set"],
] as const;

export function ProductGolfFields({
  family,
  category,
  register,
  control,
  fieldError,
}: Props) {
  const clubType = useWatch({ control, name: "clubType" });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "components",
  });

  return (
    <section className="space-y-6 rounded-xl border bg-white p-5 sm:p-6">
      <div>
        <p className="text-pg-gold text-xs font-semibold tracking-[0.16em] uppercase">
          Especificaciones de golf
        </p>
        <h2 className="mt-2 text-lg font-semibold">
          {family === "club" ? "Bastón" : family === "bag" ? "Bolsa" : "Set"}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Estos datos se guardan estructurados para búsqueda, filtros y
          asesoría.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {family === "club" ? (
          <SelectField
            id="clubType"
            label="Tipo de bastón"
            error={fieldError("clubType")}
          >
            {category?.clubType ? (
              <>
                <input type="hidden" {...register("clubType")} />
                <select
                  id="clubType"
                  className={selectClassName}
                  value={category.clubType}
                  disabled
                >
                  {clubOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <select
                id="clubType"
                className={selectClassName}
                {...register("clubType")}
              >
                <option value="">Selecciona un tipo</option>
                {clubOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </SelectField>
        ) : null}
        {family === "bag" ? (
          <SelectField
            id="bagType"
            label="Tipo de bolsa"
            error={fieldError("bagType")}
          >
            {category?.bagType ? (
              <>
                <input type="hidden" {...register("bagType")} />
                <select
                  id="bagType"
                  className={selectClassName}
                  value={category.bagType}
                  disabled
                >
                  {bagOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <select
                id="bagType"
                className={selectClassName}
                {...register("bagType")}
              >
                <option value="">Selecciona un tipo</option>
                {bagOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </SelectField>
        ) : null}
        {family === "set" ? (
          <SelectField
            id="setType"
            label="Tipo de set"
            error={fieldError("setType")}
          >
            {category?.setType ? (
              <>
                <input type="hidden" {...register("setType")} />
                <select
                  id="setType"
                  className={selectClassName}
                  value={category.setType}
                  disabled
                >
                  {setOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <select
                id="setType"
                className={selectClassName}
                {...register("setType")}
              >
                <option value="">Selecciona un tipo</option>
                {setOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </SelectField>
        ) : null}
        <TextField id="model" label="Modelo" register={register} />
        <TextField
          id="modelYear"
          label="Año"
          register={register}
          inputMode="numeric"
        />
        {family !== "bag" ? <HandednessField register={register} /> : null}
      </div>

      {family === "club" || family === "set" ? (
        <div className="space-y-4 border-t pt-6">
          <h3 className="font-semibold">Shaft</h3>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <SelectField id="shaftMaterial" label="Material">
              <select
                id="shaftMaterial"
                className={selectClassName}
                {...register("shaftMaterial")}
              >
                <option value="">No especificado</option>
                <option value="graphite">Grafito</option>
                <option value="steel">Acero</option>
                <option value="other">Otro</option>
              </select>
            </SelectField>
            <SelectField id="shaftFlex" label="Flex">
              <select
                id="shaftFlex"
                className={selectClassName}
                {...register("shaftFlex")}
              >
                <option value="">No especificado</option>
                <option value="ladies">Ladies</option>
                <option value="senior">Senior</option>
                <option value="regular">Regular</option>
                <option value="stiff">Stiff</option>
                <option value="x_stiff">X-Stiff</option>
                <option value="other">Otro</option>
              </select>
            </SelectField>
            {family === "club" ? (
              <TextField
                id="shaftWeightGrams"
                label="Peso (g)"
                register={register}
                inputMode="decimal"
              />
            ) : null}
            {family === "club" ? (
              <TextField
                id="shaftBrand"
                label="Marca del shaft"
                register={register}
              />
            ) : null}
            {family === "club" ? (
              <TextField
                id="shaftModel"
                label="Modelo del shaft"
                register={register}
              />
            ) : null}
            {family === "club" ? (
              <TextField
                id="clubLengthInches"
                label="Largo (in)"
                register={register}
                inputMode="decimal"
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {family === "club" ? (
        <ClubSpecificFields clubType={clubType} register={register} />
      ) : family === "bag" ? (
        <BagFields register={register} />
      ) : (
        <SetComponents
          fields={fields}
          append={append}
          remove={remove}
          register={register}
          error={fieldError("components")}
        />
      )}

      <SelectField id="specificationNotes" label="Notas de especificación">
        <textarea
          id="specificationNotes"
          className={textareaClassName}
          rows={3}
          {...register("specificationNotes")}
        />
      </SelectField>
    </section>
  );
}

function ClubSpecificFields({
  clubType,
  register,
}: {
  clubType: ProductFormValues["clubType"];
  register: UseFormRegister<ProductFormValues>;
}) {
  return (
    <div className="space-y-5 border-t pt-6">
      <h3 className="font-semibold">Configuración del bastón</h3>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {clubType === "fairway_wood" || clubType === "hybrid" ? (
          <TextField
            id="clubNumber"
            label="Número (3W, 4H…)"
            register={register}
          />
        ) : null}
        {clubType === "iron" ? (
          <TextField
            id="ironNumber"
            label="Número de hierro"
            register={register}
          />
        ) : null}
        {clubType ? (
          <TextField
            id="loftDegrees"
            label="Loft (°)"
            register={register}
            inputMode="decimal"
          />
        ) : null}
        {clubType === "wedge" ? (
          <TextField
            id="bounceDegrees"
            label="Bounce (°)"
            register={register}
            inputMode="decimal"
          />
        ) : null}
        {clubType === "wedge" ? (
          <TextField id="grind" label="Grind" register={register} />
        ) : null}
        {clubType === "putter" ? (
          <SelectField id="putterHeadType" label="Cabeza">
            <select
              id="putterHeadType"
              className={selectClassName}
              {...register("putterHeadType")}
            >
              <option value="">No especificado</option>
              <option value="blade">Blade</option>
              <option value="mallet">Mallet</option>
            </select>
          </SelectField>
        ) : null}
        {clubType === "putter" ? (
          <TextField
            id="lengthInches"
            label="Largo del putter (in)"
            register={register}
            inputMode="decimal"
          />
        ) : null}
        {clubType === "putter" ? (
          <TextField
            id="lieDegrees"
            label="Lie (°)"
            register={register}
            inputMode="decimal"
          />
        ) : null}
        {clubType === "putter" ? (
          <TextField id="neckType" label="Tipo de cuello" register={register} />
        ) : null}
        {clubType === "driver" ? (
          <TriStateField
            id="adjustableLoft"
            label="Loft ajustable"
            register={register}
          />
        ) : null}
        {clubType === "driver" ||
        clubType === "fairway_wood" ||
        clubType === "hybrid" ? (
          <TriStateField
            id="adjustableHosel"
            label="Hosel ajustable"
            register={register}
          />
        ) : null}
        {clubType === "driver" ? (
          <TriStateField
            id="adjustmentToolIncluded"
            label="Incluye herramienta"
            register={register}
          />
        ) : null}
        <TriStateField
          id="headcoverIncluded"
          label="Incluye headcover"
          register={register}
        />
        <TextField id="gripBrand" label="Marca del grip" register={register} />
        <TextField id="gripModel" label="Modelo del grip" register={register} />
        <TextField
          id="gripCondition"
          label="Condición del grip"
          register={register}
        />
      </div>
    </div>
  );
}

function BagFields({
  register,
}: {
  register: UseFormRegister<ProductFormValues>;
}) {
  return (
    <div className="grid gap-5 border-t pt-6 sm:grid-cols-2 lg:grid-cols-3">
      <TextField id="color" label="Color" register={register} />
      <TextField
        id="dividerCount"
        label="Divisores"
        register={register}
        inputMode="numeric"
      />
      <TextField
        id="pocketCount"
        label="Bolsillos"
        register={register}
        inputMode="numeric"
      />
      <TextField
        id="weightKg"
        label="Peso (kg)"
        register={register}
        inputMode="decimal"
      />
      <TriStateField
        id="rainHoodIncluded"
        label="Incluye cubierta de lluvia"
        register={register}
      />
      <TriStateField
        id="strapIncluded"
        label="Incluye correa"
        register={register}
      />
      <TriStateField id="waterproof" label="Impermeable" register={register} />
      <TriStateField
        id="cartCompatible"
        label="Compatible con carrito"
        register={register}
      />
    </div>
  );
}

type SetFieldsProps = {
  fields: { id: string }[];
  append: (value: ProductFormValues["components"][number]) => void;
  remove: (index: number) => void;
  register: UseFormRegister<ProductFormValues>;
  error?: string;
};
function SetComponents({
  fields,
  append,
  remove,
  register,
  error,
}: SetFieldsProps) {
  return (
    <div className="space-y-4 border-t pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Componentes del set</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            No se crean productos ni inventarios individuales.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => append(emptyComponent())}
        >
          <Plus className="size-4" />
          Agregar componente
        </Button>
      </div>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {fields.map((field, index) => (
        <ComponentRow
          key={field.id}
          index={index}
          register={register}
          remove={() => remove(index)}
        />
      ))}
    </div>
  );
}

function ComponentRow({
  index,
  register,
  remove,
}: {
  index: number;
  register: UseFormRegister<ProductFormValues>;
  remove: () => void;
}) {
  return (
    <div className="bg-pg-warm-white space-y-4 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Componente {index + 1}</h4>
        <Button type="button" size="sm" variant="ghost" onClick={remove}>
          <Trash2 className="size-4" />
          Eliminar
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField id={`components-${index}-kind`} label="Clase">
          <select
            id={`components-${index}-kind`}
            className={selectClassName}
            {...register(`components.${index}.componentKind`)}
          >
            <option value="club">Bastón</option>
            <option value="bag">Bolsa</option>
          </select>
        </SelectField>
        <SelectField id={`components-${index}-club`} label="Tipo de bastón">
          <select
            id={`components-${index}-club`}
            className={selectClassName}
            {...register(`components.${index}.clubType`)}
          >
            <option value="">No aplica</option>
            {clubOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </SelectField>
        <SelectField id={`components-${index}-bag`} label="Tipo de bolsa">
          <select
            id={`components-${index}-bag`}
            className={selectClassName}
            {...register(`components.${index}.bagType`)}
          >
            <option value="">No aplica</option>
            {bagOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </SelectField>
        <SelectField id={`components-${index}-quantity`} label="Cantidad">
          <Input
            id={`components-${index}-quantity`}
            inputMode="numeric"
            {...register(`components.${index}.quantity`)}
          />
        </SelectField>
        <SelectField id={`components-${index}-number`} label="Número">
          <Input
            id={`components-${index}-number`}
            {...register(`components.${index}.componentNumber`)}
          />
        </SelectField>
        <SelectField id={`components-${index}-loft`} label="Loft (°)">
          <Input
            id={`components-${index}-loft`}
            inputMode="decimal"
            {...register(`components.${index}.loftDegrees`)}
          />
        </SelectField>
        <SelectField id={`components-${index}-brand`} label="Marca">
          <Input
            id={`components-${index}-brand`}
            {...register(`components.${index}.brand`)}
          />
        </SelectField>
        <SelectField id={`components-${index}-model`} label="Modelo">
          <Input
            id={`components-${index}-model`}
            {...register(`components.${index}.model`)}
          />
        </SelectField>
        <SelectField id={`components-${index}-hand`} label="Orientación">
          <select
            id={`components-${index}-hand`}
            className={selectClassName}
            {...register(`components.${index}.handedness`)}
          >
            <option value="">No especificada</option>
            <option value="right">Diestro</option>
            <option value="left">Zurdo</option>
          </select>
        </SelectField>
        <SelectField id={`components-${index}-flex`} label="Flex">
          <select
            id={`components-${index}-flex`}
            className={selectClassName}
            {...register(`components.${index}.shaftFlex`)}
          >
            <option value="">No especificado</option>
            <option value="ladies">Ladies</option>
            <option value="senior">Senior</option>
            <option value="regular">Regular</option>
            <option value="stiff">Stiff</option>
            <option value="x_stiff">X-Stiff</option>
            <option value="other">Otro</option>
          </select>
        </SelectField>
        <SelectField id={`components-${index}-material`} label="Material">
          <select
            id={`components-${index}-material`}
            className={selectClassName}
            {...register(`components.${index}.shaftMaterial`)}
          >
            <option value="">No especificado</option>
            <option value="graphite">Grafito</option>
            <option value="steel">Acero</option>
            <option value="other">Otro</option>
          </select>
        </SelectField>
        <SelectField id={`components-${index}-condition`} label="Condición">
          <select
            id={`components-${index}-condition`}
            className={selectClassName}
            {...register(`components.${index}.condition`)}
          >
            <option value="">No especificada</option>
            <option value="new">Nuevo</option>
            <option value="used">Seminuevo</option>
          </select>
        </SelectField>
      </div>
    </div>
  );
}

function emptyComponent(): ProductFormValues["components"][number] {
  return {
    componentKind: "club",
    quantity: "1",
    clubType: "",
    bagType: "",
    componentNumber: "",
    loftDegrees: "",
    handedness: "",
    shaftFlex: "",
    shaftMaterial: "",
    brand: "",
    model: "",
    condition: "",
    conditionGrade: "",
  };
}

function HandednessField({
  register,
}: {
  register: UseFormRegister<ProductFormValues>;
}) {
  return (
    <SelectField id="handedness" label="Orientación">
      <select
        id="handedness"
        className={selectClassName}
        {...register("handedness")}
      >
        <option value="">No especificada</option>
        <option value="right">Diestro</option>
        <option value="left">Zurdo</option>
      </select>
    </SelectField>
  );
}
function TextField({
  id,
  label,
  register,
  inputMode,
}: {
  id: keyof ProductFormValues;
  label: string;
  register: UseFormRegister<ProductFormValues>;
  inputMode?: "numeric" | "decimal";
}) {
  return (
    <SelectField id={String(id)} label={label}>
      <Input id={String(id)} inputMode={inputMode} {...register(id)} />
    </SelectField>
  );
}
function TriStateField({
  id,
  label,
  register,
}: {
  id:
    | "headcoverIncluded"
    | "adjustableLoft"
    | "adjustableHosel"
    | "adjustmentToolIncluded"
    | "rainHoodIncluded"
    | "strapIncluded"
    | "waterproof"
    | "cartCompatible";
  label: string;
  register: UseFormRegister<ProductFormValues>;
}) {
  return (
    <SelectField id={id} label={label}>
      <select id={id} className={selectClassName} {...register(id)}>
        <option value="">No especificado</option>
        <option value="yes">Sí</option>
        <option value="no">No</option>
      </select>
    </SelectField>
  );
}
function SelectField({
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
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
