import { getConditionLabel } from "@/lib/catalog/presentation";
import type { PublicProduct } from "@/lib/catalog/public-products";

type SpecRow = { label: string; value: string | null };

const clubLabels = {
  driver: "Driver",
  fairway_wood: "Fairway Wood",
  hybrid: "Hybrid",
  iron: "Iron",
  wedge: "Wedge",
  putter: "Putter",
} as const;
const bagLabels = {
  cart_bag: "Cart Bag",
  stand_bag: "Stand Bag",
  tour_bag: "Tour Bag",
  pencil_bag: "Pencil Bag",
  travel_bag: "Travel Bag",
} as const;
const setLabels = {
  complete_set: "Complete Set",
  iron_set: "Iron Set",
  starter_set: "Starter Set",
  junior_set: "Junior Set",
} as const;
const handLabels = { right: "Diestro", left: "Zurdo" } as const;
const materialLabels = {
  graphite: "Grafito",
  steel: "Acero",
  other: "Otro",
} as const;
const flexLabels = {
  ladies: "Ladies",
  senior: "Senior",
  regular: "Regular",
  stiff: "Stiff",
  x_stiff: "X-Stiff",
  other: "Otro",
} as const;
const putterLabels = { blade: "Blade", mallet: "Mallet" } as const;

export function ProductSpecifications({ product }: { product: PublicProduct }) {
  const rows = specificationRows(product).filter(
    (row): row is { label: string; value: string } => Boolean(row.value),
  );

  if (rows.length === 0 && product.components.length === 0) return null;

  return (
    <section
      className="border-border mt-16 grid gap-8 border-t pt-12 md:grid-cols-[0.42fr_0.58fr] md:gap-16 lg:mt-20 lg:pt-16"
      aria-labelledby="specifications-title"
    >
      <div>
        <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
          Especificaciones reales
        </p>
        <h2
          id="specifications-title"
          className="font-heading text-pg-black mt-3 text-3xl font-bold sm:text-4xl"
        >
          La configuración, con claridad.
        </h2>
      </div>
      <div className="min-w-0">
        {rows.length > 0 ? (
          <dl className="divide-border divide-y border-y">
            {rows.map((row) => (
              <div
                key={row.label}
                className="grid gap-1 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6"
              >
                <dt className="text-muted-foreground text-sm">{row.label}</dt>
                <dd className="text-pg-black min-w-0 text-sm font-medium break-words">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {product.components.length > 0 ? (
          <div className={rows.length > 0 ? "mt-8" : ""}>
            <h3 className="text-pg-black font-semibold">Composición del set</h3>
            <ul className="mt-4 space-y-3">
              {product.components.map((component) => (
                <li
                  key={component.id}
                  className="bg-pg-warm-white rounded-xl border px-4 py-4 text-sm leading-6 sm:px-5"
                >
                  {formatComponent(component)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function specificationRows(product: PublicProduct): SpecRow[] {
  const condition = getConditionLabel(
    product.condition,
    product.conditionGrade,
    product.conditionScore,
  );
  if (product.clubSpecs) {
    const spec = product.clubSpecs;
    return compactRows([
      ["Tipo", clubLabels[spec.club_type]],
      ["Modelo", spec.model],
      ["Año", number(spec.model_year)],
      ["Mano", enumValue(spec.handedness, handLabels)],
      ["Número", spec.club_number ?? spec.iron_number],
      ["Loft", degrees(spec.loft_degrees)],
      ["Bounce", degrees(spec.bounce_degrees)],
      ["Grind", spec.grind],
      ["Flex", enumValue(spec.shaft_flex, flexLabels)],
      ["Varilla", join(spec.shaft_brand, spec.shaft_model)],
      ["Material", enumValue(spec.shaft_material, materialLabels)],
      ["Peso de varilla", unit(spec.shaft_weight_grams, "g")],
      ["Largo", unit(spec.club_length_inches, "in")],
      ["Grip", join(spec.grip_brand, spec.grip_model)],
      ["Condición del grip", spec.grip_condition],
      ["Cabeza", enumValue(spec.putter_head_type, putterLabels)],
      ["Largo del putter", unit(spec.length_inches, "in")],
      ["Lie", degrees(spec.lie_degrees)],
      ["Cuello", spec.neck_type],
      ["Loft ajustable", yesNo(spec.adjustable_loft)],
      ["Hosel ajustable", yesNo(spec.adjustable_hosel)],
      ["Herramienta incluida", yesNo(spec.adjustment_tool_included)],
      ["Headcover incluido", yesNo(spec.headcover_included)],
      ["Estado", condition],
    ]);
  }
  if (product.bagSpecs) {
    const spec = product.bagSpecs;
    return compactRows([
      ["Tipo", bagLabels[spec.bag_type]],
      ["Modelo", spec.model],
      ["Año", number(spec.model_year)],
      ["Color", spec.color],
      ["Divisores", number(spec.divider_count)],
      ["Bolsillos", number(spec.pocket_count)],
      ["Peso", unit(spec.weight_kg, "kg")],
      ["Cubierta de lluvia", yesNo(spec.rain_hood_included)],
      ["Correa incluida", yesNo(spec.strap_included)],
      ["Impermeable", yesNo(spec.waterproof)],
      ["Compatible con carrito", yesNo(spec.cart_compatible)],
      ["Estado", condition],
    ]);
  }
  if (product.setSpecs) {
    const spec = product.setSpecs;
    return compactRows([
      ["Tipo", setLabels[spec.set_type]],
      ["Modelo", spec.model],
      ["Año", number(spec.model_year)],
      ["Mano", enumValue(spec.handedness, handLabels)],
      ["Flex", enumValue(spec.shaft_flex, flexLabels)],
      ["Material", enumValue(spec.shaft_material, materialLabels)],
      ["Estado", condition],
    ]);
  }
  return [];
}

function compactRows(rows: Array<[string, string | null]>): SpecRow[] {
  return rows.map(([label, value]) => ({ label, value }));
}

function formatComponent(
  component: PublicProduct["components"][number],
): string {
  const parts: string[] = [];
  if (component.quantity > 1) parts.push(`${component.quantity} ×`);
  if (component.component_kind === "club" && component.club_type) {
    parts.push(clubLabels[component.club_type]);
  } else if (component.bag_type) {
    parts.push(bagLabels[component.bag_type]);
  }
  if (component.component_number) parts.push(component.component_number);
  if (component.loft_degrees !== null) parts.push(`${component.loft_degrees}°`);
  if (component.brand || component.model)
    parts.push(`· ${join(component.brand, component.model)}`);
  if (component.handedness) parts.push(`· ${handLabels[component.handedness]}`);
  if (component.shaft_flex) parts.push(`· ${flexLabels[component.shaft_flex]}`);
  if (component.shaft_material)
    parts.push(`· ${materialLabels[component.shaft_material]}`);
  if (component.condition)
    parts.push(
      `· ${getConditionLabel(component.condition, component.condition_grade)}`,
    );
  return parts.join(" ");
}

function enumValue<T extends string>(
  value: T | null,
  labels: Record<T, string>,
): string | null {
  return value ? labels[value] : null;
}
const number = (value: number | null) =>
  value === null ? null : String(value);
const unit = (value: number | null, suffix: string) =>
  value === null ? null : `${value} ${suffix}`;
const degrees = (value: number | null) => (value === null ? null : `${value}°`);
const yesNo = (value: boolean | null) =>
  value === null ? null : value ? "Sí" : "No";
const join = (...values: Array<string | null>) =>
  values.filter(Boolean).join(" ") || null;
