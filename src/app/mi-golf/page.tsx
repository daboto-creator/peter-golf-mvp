import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

import { PublicFooter } from "@/components/catalog/public-footer";
import { PublicHeader } from "@/components/catalog/public-header";
import { BestRoundProOpenButton } from "@/components/best-round-pro/best-round-pro-open-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAuthenticatedUser } from "@/lib/auth/user";
import {
  displayGolfCategory,
  type GolfEquipmentCategory,
  type GolfModelSuggestion,
} from "@/lib/catalog/golf-equipment-reference";
import { listActiveCatalogReferences } from "@/lib/catalog/operational-products";
import { createClient } from "@/lib/supabase/server";
import {
  DeactivateEquipmentForm,
  EquipmentEditForm,
  EquipmentForm,
  ObjectiveForm,
  ObjectiveStatusForm,
  ProfileForm,
} from "./forms";
import { resolveBrandAsset } from "@/lib/mi-golf/brand-assets";

export const metadata: Metadata = { title: "Mi Golf | Best Round Pro Shop" };

function equipmentSpecs(category: string, value: unknown): string | null {
  const specs = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const text = (key: string) => typeof specs[key] === "string" || typeof specs[key] === "number" ? String(specs[key]) : null;
  const loft = text("loft") ?? text("loft_degrees");
  const flex = text("shaftFlex") ?? text("shaft_flex");
  const material = text("shaftMaterial") ?? text("shaft_material");
  const bounce = text("bounce") ?? text("bounce_degrees");
  const length = text("length") ?? text("length_inches");
  const normalized = category.toLowerCase();
  const parts: string[] = [];
  if (loft) parts.push(`${loft}°`);
  if (bounce && normalized.includes("wedge")) parts.push(`${bounce}° bounce`);
  if (length && normalized.includes("putter")) parts.push(`${length}\"`);
  if (flex) parts.push(flex);
  if (material) parts.push(material.toLowerCase() === "graphite" ? "Grafito" : material.toLowerCase() === "steel" ? "Acero" : material);
  return parts.length ? parts.join(" · ") : null;
}

function skillLabel(value: unknown): string {
  const labels: Record<string, string> = { BEGINNER: "Principiante", INTERMEDIATE: "Intermedio", ADVANCED: "Avanzado" };
  return labels[String(value ?? "").toUpperCase()] ?? String(value ?? "");
}

function recommendationLabel(value: unknown): string {
  const labels: Record<string, string> = { RECOMMENDED: "Recomendado", RECOMMENDED_WITH_CAVEAT: "Recomendado con matices", NOT_RECOMMENDED: "No es mi primera opción" };
  return labels[String(value ?? "").toUpperCase()] ?? String(value ?? "");
}

function equipmentFamily(value: unknown): string {
  const category = String(value ?? "").toLowerCase().replace(/[_-]+/g, " ");
  if (category.includes("driver")) return "driver";
  if (category.includes("fairway") || category.includes("madera")) return "fairway";
  if (category.includes("hybrid") || category.includes("híbrido") || category.includes("hibrido")) return "hybrid";
  if (category.includes("iron") || category.includes("hierro")) return "iron";
  if (category.includes("wedge")) return "wedge";
  if (category.includes("putter")) return "putter";
  if (category.includes("set") || category.includes("bag")) return "set";
  return "other";
}

export default async function MiGolfPage() {
  const user = await requireAuthenticatedUser("/mi-golf");
  const supabase = await createClient();
  const [
    { data: profile },
    { data: equipment },
    { data: objectives },
    catalogReferences,
    { data: recommendations },
  ] = await Promise.all([
    supabase
      .from("mi_golf_profiles" as never)
      .select("handicap,handicap_status,handicap_source,handedness,handedness_source,skill_level,skill_level_source,play_frequency,shot_tendency")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("mi_golf_equipment" as never)
      .select("id,category,brand,model,specifications,source,notes")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("updated_at", { ascending: false }),
    supabase
      .from("mi_golf_objectives" as never)
      .select("id,objective_type,status,details")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    listActiveCatalogReferences(),
    supabase
      .from("mi_golf_recommendation_snapshots" as never)
      .select("id,product_name,product_family,recommendation_outcome,recommendation_strength,key_reasons,caveats,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  const p = (profile ?? {}) as Record<string, unknown>;
  const items = (equipment ?? []) as unknown as Array<Record<string, unknown>>;
  const goals = (objectives ?? []) as unknown as Array<Record<string, unknown>>;
  const recommendationRows = (recommendations ?? []) as unknown as Array<Record<string, unknown>>;
  const canonicalReferences = catalogReferences.data;
  const categoryOptions: GolfEquipmentCategory[] = (canonicalReferences?.categories ?? [])
    .filter((category) => ["club", "set", "bag"].includes(category.family ?? ""))
    .map((category) => ({
      id: category.id,
      slug: category.slug ?? category.id,
      label: displayGolfCategory(category.family ?? "", category.clubType ?? category.bagType ?? category.setType ?? null, category.name),
      family: category.family ?? "",
      kind: category.clubType ?? category.bagType ?? category.setType ?? null,
    }));
  const brandOptions = (canonicalReferences?.brands ?? []).map((brand) => ({ id: brand.id, name: brand.name, slug: brand.slug ?? brand.id }));
  const modelOptions: GolfModelSuggestion[] = canonicalReferences?.models ?? [];
  const equipmentGroups = [
    { key: "driver", label: "Driver" },
    { key: "fairway", label: "Maderas" },
    { key: "hybrid", label: "Híbridos" },
    { key: "iron", label: "Hierros" },
    { key: "wedge", label: "Wedges" },
    { key: "putter", label: "Putter" },
    { key: "set", label: "Sets" },
    { key: "other", label: "Otros" },
  ].map((group) => ({ ...group, items: items.filter((item) => equipmentFamily(item.category) === group.key) })).filter((group) => group.items.length);
  return (
    <div className="bg-pg-warm-white min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
              Mi Golf
            </p>
            <h1 className="font-heading mt-2 text-4xl font-bold">
              Tu juego, siempre contigo
            </h1>
            <p className="text-muted-foreground mt-2">
              Guarda lo que tú decidas para que Best Round Pro pueda ayudarte
              mejor.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/cuenta">Volver a Mi cuenta</Link>
          </Button>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Mi perfil</CardTitle>
              <CardDescription>
                Datos que tú declaras. Puedes corregirlos cuando quieras.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileForm profile={p} />
              <div className="mt-4 grid gap-2 text-sm">
                {p.handicap ? <span><span className="text-muted-foreground">Handicap</span><br /><strong>{String(p.handicap)}</strong></span> : null}
                {p.skill_level ? <span><span className="text-muted-foreground">Nivel</span><br /><strong>{skillLabel(p.skill_level)}</strong></span> : null}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recomendaciones</CardTitle>
              <CardDescription>
                Historial personal, separado de tus datos editables.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recommendationRows.length ? (
                <div className="space-y-3">
                  {recommendationRows.map((item) => (
                    <div key={String(item.id)} className="rounded-lg border p-3">
                      <p className="font-medium">{String(item.product_name)}</p>
                      <p className="text-muted-foreground text-xs">
                        {recommendationLabel(item.recommendation_outcome)} · {new Date(String(item.created_at)).toLocaleDateString("es-MX")}
                      </p>
                      {Array.isArray(item.key_reasons) && item.key_reasons.length ? (
                        <p className="text-muted-foreground mt-1 text-xs">{item.key_reasons.join(", ")}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : <p className="text-muted-foreground text-sm">Aún no tienes recomendaciones guardadas.</p>}
              <BestRoundProOpenButton>Pedir recomendación a Best Round Pro</BestRoundProOpenButton>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Mi equipo</CardTitle>
              <CardDescription>
                Agrega equipo actual, aunque no lo hayas comprado aquí.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <EquipmentForm
                categories={categoryOptions}
                brands={brandOptions}
                models={modelOptions}
                referenceLoadError={catalogReferences.error !== null}
              />
              {equipmentGroups.length ? equipmentGroups.map((group) => (
                <section key={group.key} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">{group.label}</h3>
                    <div className="h-px flex-1 bg-black/10" />
                    <span className="text-muted-foreground text-xs">{group.items.length}</span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {group.items.map((item) => {
                      const brand = resolveBrandAsset({ brandName: typeof item.brand === "string" ? item.brand : null });
                      const category = String(item.category ?? "");
                      const specs = equipmentSpecs(category, item.specifications);
                      return (
                        <div key={String(item.id)} className="rounded-2xl border border-black/5 bg-white p-5 shadow-[0_8px_24px_rgba(19,35,56,0.06)]">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex h-12 min-w-0 items-center gap-3">
                              {brand.logoSrc ? (
                                <div className="flex h-11 w-24 shrink-0 items-center rounded-lg bg-[#faf9f6] px-2">
                                  <Image src={brand.logoSrc} alt={brand.alt} width={88} height={42} className="max-h-8 w-auto max-w-[88px] object-contain" />
                                </div>
                              ) : (
                                <span aria-label={brand.alt} className="bg-pg-navy text-pg-gold flex h-11 w-20 shrink-0 items-center justify-center rounded-lg px-2 text-xs font-semibold">{String(item.brand ?? "Marca")}</span>
                              )}
                              <span className="shrink-0 rounded-full bg-[#f4f1e8] px-2 py-1 text-[10px] font-medium text-[#6f634e]">Actual</span>
                            </div>
                          </div>
                          <div className="mt-4">
                            <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.16em] uppercase">{displayGolfCategory(category, null, "Equipo")}</p>
                            <p className="mt-1 text-lg font-semibold text-[#132338]">{[item.brand, item.model].filter(Boolean).join(" ") || displayGolfCategory(category, null, "Equipo")}</p>
                            {specs ? <p className="mt-2 text-sm font-medium text-[#132338]">{specs}</p> : null}
                          </div>
                          <div className="mt-5 flex items-center gap-2 border-t border-black/5 pt-3">
                            <EquipmentEditForm item={item} />
                            <DeactivateEquipmentForm id={String(item.id)} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )) : <p className="text-muted-foreground text-sm">Aún no has agregado equipo.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Mis objetivos</CardTitle>
              <CardDescription>
                Puedes tener varios y cambiar su estado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <ObjectiveForm />
              <div className="space-y-2">
                {goals.length ? (
                  goals.map((goal) => (
                    <div
                      key={String(goal.id)}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">
                          {String(goal.objective_type)}
                        </p>
                        {goal.details ? (
                          <p className="text-muted-foreground text-xs">
                            {String(goal.details)}
                          </p>
                        ) : null}
                      </div>
                      <ObjectiveStatusForm
                        id={String(goal.id)}
                        status={String(goal.status)}
                      />
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Aún no has agregado objetivos.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
