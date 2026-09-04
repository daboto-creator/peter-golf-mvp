import type { Metadata } from "next";
import Link from "next/link";

import { PublicFooter } from "@/components/catalog/public-footer";
import { PublicHeader } from "@/components/catalog/public-header";
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
  type GolfBrandSuggestion,
  type GolfEquipmentCategory,
  type GolfModelSuggestion,
} from "@/lib/catalog/golf-equipment-reference";
import { createClient } from "@/lib/supabase/server";
import {
  DeactivateEquipmentForm,
  EquipmentEditForm,
  EquipmentForm,
  ObjectiveForm,
  ObjectiveStatusForm,
  ProfileForm,
} from "./forms";

export const metadata: Metadata = { title: "Mi Golf | Best Round Pro Shop" };

export default async function MiGolfPage() {
  const user = await requireAuthenticatedUser("/mi-golf");
  const supabase = await createClient();
  const [
    { data: profile },
    { data: equipment },
    { data: objectives },
    { data: categories },
    { data: brands },
    { data: models },
  ] = await Promise.all([
    supabase
      .from("mi_golf_profiles" as never)
      .select("handicap,handedness,skill_level,play_frequency,shot_tendency")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("mi_golf_equipment" as never)
      .select("id,category,brand,model,notes")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("updated_at", { ascending: false }),
    supabase
      .from("mi_golf_objectives" as never)
      .select("id,objective_type,status,details")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("categories" as never)
      .select(
        "id,slug,name,category_spec_profiles(family,club_type,bag_type,set_type)",
      )
      .eq("status", "active")
      .order("sort_order"),
    supabase
      .from("brands" as never)
      .select("id,name,slug")
      .eq("status", "active")
      .order("name")
      .limit(200),
    supabase
      .from("catalog_product_models" as never)
      .select("id,brand_id,category_id,model_name,normalized_model_name")
      .eq("status", "active")
      .order("model_name")
      .limit(500),
  ]);
  const p = (profile ?? {}) as Record<string, unknown>;
  const items = (equipment ?? []) as unknown as Array<Record<string, unknown>>;
  const goals = (objectives ?? []) as unknown as Array<Record<string, unknown>>;
  const categoryRows = (categories ?? []) as unknown as Array<
    Record<string, unknown>
  >;
  const categoryOptions: GolfEquipmentCategory[] = categoryRows
    .map((row) => {
      const spec = Array.isArray(row.category_spec_profiles)
        ? row.category_spec_profiles[0]
        : row.category_spec_profiles;
      const s = (spec ?? {}) as Record<string, unknown>;
      const kind = s.club_type
        ? String(s.club_type)
        : s.bag_type
          ? String(s.bag_type)
          : s.set_type
            ? String(s.set_type)
            : null;
      return {
        id: String(row.id),
        slug: String(row.slug),
        label: displayGolfCategory(
          String(s.family ?? ""),
          kind,
          String(row.name),
        ),
        family: String(s.family ?? ""),
        kind,
      };
    })
    .filter((category) => ["club", "set", "bag"].includes(category.family));
  const brandOptions = (brands ?? []) as unknown as GolfBrandSuggestion[];
  const modelOptions: GolfModelSuggestion[] = (models ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      brandId: String(r.brand_id),
      categoryId: String(r.category_id),
      name: String(r.model_name),
      normalizedName: String(r.normalized_model_name),
    };
  });
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
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recomendaciones</CardTitle>
              <CardDescription>
                La memoria está lista para tu próxima conversación.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Cuando uses Best Round Pro, aquí podrás consultar tus
                recomendaciones.
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
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
              />
              <div className="space-y-3">
                {items.length ? (
                  items.map((item) => (
                    <div
                      key={String(item.id)}
                      className="rounded-lg border p-3"
                    >
                      <EquipmentEditForm item={item} />
                      <DeactivateEquipmentForm id={String(item.id)} />
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Aún no has agregado equipo.
                  </p>
                )}
              </div>
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
