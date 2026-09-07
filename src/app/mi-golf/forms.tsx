"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addMiGolfEquipmentAction,
  addMiGolfObjectiveAction,
  deactivateMiGolfEquipmentAction,
  saveMiGolfProfileAction,
  updateMiGolfEquipmentAction,
  updateMiGolfObjectiveStatusAction,
} from "@/lib/mi-golf/actions";
import type {
  GolfEquipmentCategory,
  GolfBrandSuggestion,
  GolfModelSuggestion,
} from "@/lib/catalog/golf-equipment-reference";

function Feedback({
  state,
}: {
  state: { ok: boolean; message?: string } | null;
}) {
  return state ? (
    <p
      role="status"
      className={state.ok ? "text-sm text-emerald-700" : "text-sm text-red-700"}
    >
      {state.message}
    </p>
  ) : null;
}

export function ProfileForm({ profile }: { profile: Record<string, unknown> }) {
  const [state, setState] = useState<{ ok: boolean; message?: string } | null>(
    null,
  );
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setState(null);
        const data = new FormData(event.currentTarget);
        start(async () => setState(await saveMiGolfProfileAction(data)));
      }}
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
          defaultValue={String(profile.handicap ?? "")}
        />
      </div>
      <div>
        <Label htmlFor="handedness">Mano</Label>
        <select
          id="handedness"
          name="handedness"
          defaultValue={String(profile.handedness ?? "").toUpperCase()}
          className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
        >
          <option value="">Selecciona</option>
          <option value="RIGHT">Diestro</option>
          <option value="LEFT">Zurdo</option>
          <option value="UNKNOWN">No estoy seguro</option>
        </select>
      </div>
      <div>
        <Label htmlFor="skillLevel">Nivel</Label>
        <select
          id="skillLevel"
          name="skillLevel"
          defaultValue={String(profile.skill_level ?? "")}
          className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
        >
          <option value="">Selecciona</option>
          <option>Principiante</option>
          <option>Intermedio</option>
          <option>Avanzado</option>
          <option>No estoy seguro</option>
        </select>
      </div>
      <div>
        <Label htmlFor="playFrequency">Frecuencia</Label>
        <select
          id="playFrequency"
          name="playFrequency"
          defaultValue={String(profile.play_frequency ?? "")}
          className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
        >
          <option value="">Selecciona</option>
          <option>Ocasional</option>
          <option>Mensual</option>
          <option>Semanal</option>
          <option>Varias veces por semana</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="shotTendency">Tendencia de tiro (opcional)</Label>
        <select
          id="shotTendency"
          name="shotTendency"
          defaultValue={String(profile.shot_tendency ?? "")}
          className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
        >
          <option value="">Selecciona</option>
          <option>Recto</option>
          <option>Slice</option>
          <option>Hook</option>
          <option>Draw</option>
          <option>Fade</option>
          <option>Variable</option>
          <option>No estoy seguro</option>
        </select>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar perfil"}
        </Button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function EquipmentForm({
  categories,
  brands,
  models,
}: {
  categories: GolfEquipmentCategory[];
  brands: GolfBrandSuggestion[];
  models: GolfModelSuggestion[];
}) {
  const [state, setState] = useState<{ ok: boolean; message?: string } | null>(
    null,
  );
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setState(null);
        const data = new FormData(event.currentTarget);
        const category = categories.find(
          (item) => item.label === String(data.get("category")),
        );
        const brand = brands.find(
          (item) =>
            item.name.toLowerCase() === String(data.get("brand")).toLowerCase(),
        );
        const model = models.find(
          (item) =>
            item.name.toLowerCase() ===
              String(data.get("model")).toLowerCase() &&
            (!brand || item.brandId === brand.id) &&
            (!category || item.categoryId === category.id),
        );
        if (category) data.set("categoryId", category.id);
        if (brand) data.set("canonicalBrandId", brand.id);
        if (model) data.set("canonicalModelId", model.id);
        start(async () => {
          const result = await addMiGolfEquipmentAction(data);
          setState(result);
          if (result.ok) event.currentTarget.reset();
        });
      }}
      className="grid gap-3"
    >
      <select
        name="category"
        required
        className="border-input bg-background h-10 rounded-md border px-3 text-sm"
      >
        <option value="">Categoría</option>
        {categories.map((item) => (
          <option key={item.id} value={item.label}>
            {item.label}
          </option>
        ))}
      </select>
      <Input
        name="brand"
        list="mi-golf-brands"
        placeholder="Marca (o escribe una nueva)"
      />
      <datalist id="mi-golf-brands">
        {brands.map((item) => (
          <option key={item.id} value={item.name} />
        ))}
      </datalist>
      <Input
        name="model"
        list="mi-golf-models"
        placeholder="Modelo (o escribe uno nuevo)"
      />
      <datalist id="mi-golf-models">
        {models.map((item) => (
          <option key={item.id} value={item.name} />
        ))}
      </datalist>
      <Input name="notes" placeholder="Notas (opcional)" />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Agregando…" : "Agregar a Mi equipo"}
        </Button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function EquipmentEditForm({ item }: { item: Record<string, unknown> }) {
  const [state, setState] = useState<{ ok: boolean; message?: string } | null>(
    null,
  );
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        start(async () => setState(await updateMiGolfEquipmentAction(data)));
      }}
      className="grid gap-2"
    >
      <input type="hidden" name="id" value={String(item.id)} />
      <Input name="category" defaultValue={String(item.category)} required />
      <Input name="brand" defaultValue={String(item.brand ?? "")} />
      <Input name="model" defaultValue={String(item.model ?? "")} />
      <Input name="notes" defaultValue={String(item.notes ?? "")} />
      <div className="flex items-center gap-2">
        <Button type="submit" variant="ghost" size="sm" disabled={pending}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function DeactivateEquipmentForm({ id }: { id: string }) {
  const [state, setState] = useState<{ ok: boolean; message?: string } | null>(
    null,
  );
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        start(async () =>
          setState(await deactivateMiGolfEquipmentAction(data)),
        );
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "Actualizando…" : "Ya no lo uso"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

export function ObjectiveForm() {
  const [state, setState] = useState<{ ok: boolean; message?: string } | null>(
    null,
  );
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        start(async () => {
          const result = await addMiGolfObjectiveAction(data);
          setState(result);
          if (result.ok) form.reset();
        });
      }}
      className="grid gap-3"
    >
      <Input name="objectiveType" placeholder="Ej. Más distancia" required />
      <Input name="details" placeholder="Detalle (opcional)" />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Agregando…" : "Agregar objetivo"}
        </Button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function ObjectiveStatusForm({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const [state, setState] = useState<{ ok: boolean; message?: string } | null>(
    null,
  );
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        start(async () =>
          setState(await updateMiGolfObjectiveStatusAction(data)),
        );
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        className="border-input bg-background h-9 rounded-md border px-2 text-xs"
      >
        <option value="ACTIVE">Activo</option>
        <option value="ACHIEVED">Logrado</option>
        <option value="NO_LONGER_PRIORITY">Ya no es prioridad</option>
      </select>
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "Guardando…" : "Guardar"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}
