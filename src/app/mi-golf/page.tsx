import type { Metadata } from "next";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireAuthenticatedUser } from "@/lib/auth/user";
import {
  addMiGolfEquipmentAction,
  addMiGolfObjectiveAction,
  deactivateMiGolfEquipmentAction,
  saveMiGolfProfileAction,
  updateMiGolfEquipmentAction,
  updateMiGolfObjectiveStatusAction,
} from "@/lib/mi-golf/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mi Golf | Best Round Pro Shop" };

export default async function MiGolfPage() {
  const user = await requireAuthenticatedUser("/mi-golf");
  const supabase = await createClient();
  const [{ data: profile }, { data: equipment }, { data: objectives }] =
    await Promise.all([
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
    ]);
  const p = (profile ?? {}) as Record<string, unknown>;
  const items = (equipment ?? []) as unknown as Array<Record<string, unknown>>;
  const goals = (objectives ?? []) as unknown as Array<Record<string, unknown>>;
  return (
    <div className="bg-pg-warm-white min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-10">
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
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Mi perfil</CardTitle>
              <CardDescription>
                Datos que tú declaras. Puedes corregirlos cuando quieras.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                action={saveMiGolfProfileAction}
                className="grid gap-4 sm:grid-cols-2"
              >
                <div>
                  <Label htmlFor="handicap">Handicap</Label>
                  <Input
                    id="handicap"
                    name="handicap"
                    type="number"
                    min="0"
                    max="54"
                    step="0.1"
                    defaultValue={String(p.handicap ?? "")}
                  />
                </div>
                <div>
                  <Label htmlFor="handedness">Mano</Label>
                  <select
                    id="handedness"
                    name="handedness"
                    defaultValue={String(p.handedness ?? "")}
                    className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                  >
                    <option value="">Selecciona</option>
                    <option value="right">Diestro</option>
                    <option value="left">Zurdo</option>
                    <option value="unknown">No lo sé</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="skillLevel">Nivel</Label>
                  <Input
                    id="skillLevel"
                    name="skillLevel"
                    placeholder="Principiante, intermedio..."
                    defaultValue={String(p.skill_level ?? "")}
                  />
                </div>
                <div>
                  <Label htmlFor="playFrequency">Frecuencia</Label>
                  <Input
                    id="playFrequency"
                    name="playFrequency"
                    placeholder="Semanal, mensual..."
                    defaultValue={String(p.play_frequency ?? "")}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="shotTendency">
                    Tendencia de tiro (opcional)
                  </Label>
                  <Input
                    id="shotTendency"
                    name="shotTendency"
                    placeholder="Por ejemplo: tiendo a abrir la bola"
                    defaultValue={String(p.shot_tendency ?? "")}
                  />
                </div>
                <Button type="submit" className="sm:w-fit">
                  Guardar perfil
                </Button>
              </form>
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
              <form action={addMiGolfEquipmentAction} className="grid gap-3">
                <Input
                  name="category"
                  placeholder="Categoría (Driver, Hierros...)"
                  required
                />
                <Input name="brand" placeholder="Marca (opcional)" />
                <Input name="model" placeholder="Modelo (opcional)" />
                <Input name="notes" placeholder="Notas (opcional)" />
                <Button type="submit" variant="outline">
                  Agregar equipo
                </Button>
              </form>
              <div className="space-y-3">
                {items.length ? (
                  items.map((item) => (
                    <div
                      key={String(item.id)}
                      className="rounded-lg border p-3"
                    >
                      <form
                        action={updateMiGolfEquipmentAction}
                        className="grid gap-2"
                      >
                        <input
                          type="hidden"
                          name="id"
                          value={String(item.id)}
                        />
                        <Input
                          name="category"
                          defaultValue={String(item.category)}
                          required
                        />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input
                            name="brand"
                            defaultValue={String(item.brand ?? "")}
                            placeholder="Marca"
                          />
                          <Input
                            name="model"
                            defaultValue={String(item.model ?? "")}
                            placeholder="Modelo"
                          />
                        </div>
                        <Input
                          name="notes"
                          defaultValue={String(item.notes ?? "")}
                          placeholder="Notas"
                        />
                        <Button type="submit" variant="ghost" size="sm">
                          Guardar cambios
                        </Button>
                      </form>
                      <form
                        action={deactivateMiGolfEquipmentAction}
                        className="mt-1"
                      >
                        <input
                          type="hidden"
                          name="id"
                          value={String(item.id)}
                        />
                        <Button type="submit" variant="ghost" size="sm">
                          Ya no lo uso
                        </Button>
                      </form>
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
              <form action={addMiGolfObjectiveAction} className="grid gap-3">
                <Input
                  name="objectiveType"
                  placeholder="Ej. Más distancia"
                  required
                />
                <Input name="details" placeholder="Detalle (opcional)" />
                <Button type="submit" variant="outline">
                  Agregar objetivo
                </Button>
              </form>
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
                      <form
                        action={updateMiGolfObjectiveStatusAction}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="hidden"
                          name="id"
                          value={String(goal.id)}
                        />
                        <select
                          name="status"
                          defaultValue={String(goal.status)}
                          className="border-input bg-background h-9 rounded-md border px-2 text-xs"
                        >
                          <option value="ACTIVE">Activo</option>
                          <option value="ACHIEVED">Logrado</option>
                          <option value="NO_LONGER_PRIORITY">
                            Ya no es prioridad
                          </option>
                        </select>
                        <Button type="submit" variant="ghost" size="sm">
                          Guardar
                        </Button>
                      </form>
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
