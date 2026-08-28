import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  PublicCatalogFacets,
  PublicProductFilters,
} from "@/lib/catalog/public-products";

const selectClassName =
  "border-input bg-background focus-visible:border-pg-gold h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2";

export function CatalogFilters({
  facets,
  filters,
}: {
  facets: PublicCatalogFacets;
  filters: PublicProductFilters;
}) {
  const selectedFamily = filters.family;
  return (
    <aside aria-label="Filtros del Pro Shop">
      <details className="rounded-xl border bg-white lg:hidden">
        <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold">
          Filtrar equipo
        </summary>
        <form action="/productos" className="space-y-5 border-t p-4">
          <FilterFields
            facets={facets}
            filters={filters}
            family={selectedFamily}
          />
          <Actions />
        </form>
      </details>
      <form action="/productos" className="hidden space-y-6 lg:block">
        <div className="border-b pb-5">
          <p className="text-pg-gold text-xs font-semibold tracking-[0.16em] uppercase">
            Afina tu selección
          </p>
          <h2 className="mt-2 text-lg font-semibold">Filtros</h2>
        </div>
        <FilterFields
          facets={facets}
          filters={filters}
          family={selectedFamily}
        />
        <Actions />
      </form>
    </aside>
  );
}

function FilterFields({
  facets,
  filters,
  family,
}: {
  facets: PublicCatalogFacets;
  filters: PublicProductFilters;
  family?: "club" | "bag" | "set";
}) {
  return (
    <>
      <Field label="Categoría" id="category">
        <select
          id="category"
          name="category"
          defaultValue={filters.categoryId ?? ""}
          className={selectClassName}
        >
          <option value="">Todas</option>
          {facets.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Marca" id="brand">
        <select
          id="brand"
          name="brand"
          defaultValue={filters.brandId ?? ""}
          className={selectClassName}
        >
          <option value="">Todas</option>
          {facets.brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Precio mínimo" id="min">
          <Input
            id="min"
            name="min"
            inputMode="decimal"
            defaultValue={
              filters.minimumPrice === undefined
                ? ""
                : filters.minimumPrice / 100
            }
          />
        </Field>
        <Field label="Precio máximo" id="max">
          <Input
            id="max"
            name="max"
            inputMode="decimal"
            defaultValue={
              filters.maximumPrice === undefined
                ? ""
                : filters.maximumPrice / 100
            }
          />
        </Field>
      </div>
      <Field label="Condición" id="condition">
        <select
          id="condition"
          name="condition"
          defaultValue={filters.condition ?? ""}
          className={selectClassName}
        >
          <option value="">Todas</option>
          <option value="new">Nuevo</option>
          <option value="like_new">Como nuevo</option>
          <option value="excellent">Excelente</option>
          <option value="very_good">Muy bueno</option>
          <option value="good">Bueno</option>
          <option value="fair">Con desgaste visible</option>
        </select>
      </Field>
      <Field label="Origen" id="source">
        <select
          id="source"
          name="source"
          defaultValue={filters.source ?? ""}
          className={selectClassName}
        >
          <option value="">Todos</option>
          <option value="FIRST_PARTY">Best Round</option>
          <option value="MARKETPLACE_PARTNER">Partner verificado</option>
        </select>
      </Field>
      <Check
        name="available"
        label="Disponible en stock"
        checked={filters.available}
      />
      {family === "club" ? <ClubFilters filters={filters} /> : null}
      {family === "bag" ? (
        <BagFilters facets={facets} filters={filters} />
      ) : null}
      {family === "set" ? <SetFilters filters={filters} /> : null}
    </>
  );
}

function ClubFilters({ filters }: { filters: PublicProductFilters }) {
  return (
    <div className="space-y-5 border-t pt-5">
      <p className="text-sm font-semibold">Especificaciones del bastón</p>
      <Field label="Tipo" id="clubType">
        <select
          id="clubType"
          name="clubType"
          defaultValue={filters.clubType ?? ""}
          className={selectClassName}
        >
          <option value="">Todos</option>
          <option value="driver">Driver</option>
          <option value="fairway_wood">Fairway Wood</option>
          <option value="hybrid">Hybrid</option>
          <option value="iron">Iron</option>
          <option value="wedge">Wedge</option>
          <option value="putter">Putter</option>
        </select>
      </Field>
      <HandAndShaft filters={filters} />
      <Field label="Loft" id="loft">
        <Input
          id="loft"
          name="loft"
          inputMode="decimal"
          defaultValue={filters.loftDegrees ?? ""}
        />
      </Field>
    </div>
  );
}
function BagFilters({
  facets,
  filters,
}: {
  facets: PublicCatalogFacets;
  filters: PublicProductFilters;
}) {
  return (
    <div className="space-y-5 border-t pt-5">
      <p className="text-sm font-semibold">Especificaciones de bolsa</p>
      <Field label="Tipo" id="bagType">
        <select
          id="bagType"
          name="bagType"
          defaultValue={filters.bagType ?? ""}
          className={selectClassName}
        >
          <option value="">Todos</option>
          <option value="cart_bag">Cart Bag</option>
          <option value="stand_bag">Stand Bag</option>
          <option value="tour_bag">Tour Bag</option>
          <option value="pencil_bag">Pencil Bag</option>
          <option value="travel_bag">Travel Bag</option>
        </select>
      </Field>
      <Field label="Color" id="color">
        <select
          id="color"
          name="color"
          defaultValue={filters.color ?? ""}
          className={selectClassName}
        >
          <option value="">Todos</option>
          {facets.colors.map((color) => (
            <option key={color} value={color}>
              {color}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
function SetFilters({ filters }: { filters: PublicProductFilters }) {
  return (
    <div className="space-y-5 border-t pt-5">
      <p className="text-sm font-semibold">Especificaciones del set</p>
      <Field label="Tipo" id="setType">
        <select
          id="setType"
          name="setType"
          defaultValue={filters.setType ?? ""}
          className={selectClassName}
        >
          <option value="">Todos</option>
          <option value="complete_set">Complete Set</option>
          <option value="iron_set">Iron Set</option>
          <option value="starter_set">Starter Set</option>
          <option value="junior_set">Junior Set</option>
        </select>
      </Field>
      <HandAndShaft filters={filters} />
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Incluye</legend>
        <Check name="driver" label="Driver" checked={filters.includesDriver} />
        <Check
          name="fairway"
          label="Fairway Wood"
          checked={filters.includesFairwayWood}
        />
        <Check name="hybrid" label="Hybrid" checked={filters.includesHybrid} />
        <Check name="putter" label="Putter" checked={filters.includesPutter} />
        <Check name="bag" label="Bolsa" checked={filters.includesBag} />
      </fieldset>
    </div>
  );
}
function HandAndShaft({ filters }: { filters: PublicProductFilters }) {
  return (
    <>
      <Field label="Orientación" id="handedness">
        <select
          id="handedness"
          name="handedness"
          defaultValue={filters.handedness ?? ""}
          className={selectClassName}
        >
          <option value="">Todas</option>
          <option value="right">Diestro</option>
          <option value="left">Zurdo</option>
        </select>
      </Field>
      <Field label="Flex" id="shaftFlex">
        <select
          id="shaftFlex"
          name="shaftFlex"
          defaultValue={filters.shaftFlex ?? ""}
          className={selectClassName}
        >
          <option value="">Todos</option>
          <option value="ladies">Ladies</option>
          <option value="senior">Senior</option>
          <option value="regular">Regular</option>
          <option value="stiff">Stiff</option>
          <option value="x_stiff">X-Stiff</option>
          <option value="other">Otro</option>
        </select>
      </Field>
      <Field label="Material" id="shaftMaterial">
        <select
          id="shaftMaterial"
          name="shaftMaterial"
          defaultValue={filters.shaftMaterial ?? ""}
          className={selectClassName}
        >
          <option value="">Todos</option>
          <option value="graphite">Grafito</option>
          <option value="steel">Acero</option>
          <option value="other">Otro</option>
        </select>
      </Field>
    </>
  );
}
function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
function Check({
  name,
  label,
  checked,
}: {
  name: string;
  label: string;
  checked?: boolean;
}) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm">
      <input
        type="checkbox"
        name={name}
        value="1"
        defaultChecked={checked}
        className="size-4 rounded"
      />
      {label}
    </label>
  );
}
function Actions() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button type="submit">Aplicar filtros</Button>
      <Button asChild type="button" variant="ghost">
        <Link href="/productos">Limpiar</Link>
      </Button>
    </div>
  );
}
