"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

const profileSchema = z.object({
  handicap: z.coerce.number().min(0).max(54).nullable(),
  handedness: z.enum(["", "right", "left", "unknown"]),
  skillLevel: z.string().trim().max(40),
  playFrequency: z.string().trim().max(40),
  shotTendency: z.string().trim().max(80),
});
const equipmentSchema = z.object({
  category: z.string().trim().min(1).max(80),
  brand: z.string().trim().max(120),
  model: z.string().trim().max(160),
  notes: z.string().trim().max(1000),
});
const objectiveSchema = z.object({
  objectiveType: z.string().trim().min(1).max(100),
  details: z.string().trim().max(1000),
});

function text(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

export async function saveMiGolfProfileAction(form: FormData): Promise<void> {
  const user = await requireAuthenticatedUser("/mi-golf");
  const rawHand = text(form, "handedness");
  const handicapText = text(form, "handicap");
  const parsed = profileSchema.safeParse({
    handicap: handicapText ? Number(handicapText) : null,
    handedness: rawHand,
    skillLevel: text(form, "skillLevel"),
    playFrequency: text(form, "playFrequency"),
    shotTendency: text(form, "shotTendency"),
  });
  if (!parsed.success) return;
  const supabase = await createClient();
  const { error } = await supabase.from("mi_golf_profiles" as never).upsert({
    user_id: user.id,
    handicap: parsed.data.handicap,
    handedness: parsed.data.handedness || null,
    skill_level: parsed.data.skillLevel || null,
    play_frequency: parsed.data.playFrequency || null,
    shot_tendency: parsed.data.shotTendency || null,
    memory_source: "USER_DECLARED",
    memory_confidence: "HIGH",
  } as never);
  if (error) return;
  revalidatePath("/mi-golf");
}

export async function addMiGolfEquipmentAction(form: FormData): Promise<void> {
  const user = await requireAuthenticatedUser("/mi-golf");
  const parsed = equipmentSchema.safeParse({
    category: text(form, "category"),
    brand: text(form, "brand"),
    model: text(form, "model"),
    notes: text(form, "notes"),
  });
  if (!parsed.success) return;
  const supabase = await createClient();
  const { error } = await supabase.from("mi_golf_equipment" as never).insert({
    user_id: user.id,
    category: parsed.data.category,
    brand: parsed.data.brand || null,
    model: parsed.data.model || null,
    notes: parsed.data.notes || null,
    source: "USER_DECLARED",
    confidence: "HIGH",
  } as never);
  if (error) return;
  revalidatePath("/mi-golf");
}

export async function deactivateMiGolfEquipmentAction(
  form: FormData,
): Promise<void> {
  const user = await requireAuthenticatedUser("/mi-golf");
  const id = z.uuid().safeParse(text(form, "id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase
    .from("mi_golf_equipment" as never)
    .update({ is_active: false } as never)
    .eq("id", id.data)
    .eq("user_id", user.id);
  revalidatePath("/mi-golf");
}

export async function updateMiGolfEquipmentAction(
  form: FormData,
): Promise<void> {
  const user = await requireAuthenticatedUser("/mi-golf");
  const id = z.uuid().safeParse(text(form, "id"));
  const parsed = equipmentSchema.safeParse({
    category: text(form, "category"),
    brand: text(form, "brand"),
    model: text(form, "model"),
    notes: text(form, "notes"),
  });
  if (!id.success || !parsed.success) return;
  const supabase = await createClient();
  await supabase
    .from("mi_golf_equipment" as never)
    .update({
      category: parsed.data.category,
      brand: parsed.data.brand || null,
      model: parsed.data.model || null,
      notes: parsed.data.notes || null,
      source: "USER_DECLARED",
      confidence: "HIGH",
    } as never)
    .eq("id", id.data)
    .eq("user_id", user.id);
  revalidatePath("/mi-golf");
}

export async function addMiGolfObjectiveAction(form: FormData): Promise<void> {
  const user = await requireAuthenticatedUser("/mi-golf");
  const parsed = objectiveSchema.safeParse({
    objectiveType: text(form, "objectiveType"),
    details: text(form, "details"),
  });
  if (!parsed.success) return;
  const supabase = await createClient();
  const { error } = await supabase.from("mi_golf_objectives" as never).insert({
    user_id: user.id,
    objective_type: parsed.data.objectiveType,
    details: parsed.data.details || null,
    source: "USER_DECLARED",
    confidence: "HIGH",
  } as never);
  if (error) return;
  revalidatePath("/mi-golf");
}

export async function updateMiGolfObjectiveStatusAction(
  form: FormData,
): Promise<void> {
  const user = await requireAuthenticatedUser("/mi-golf");
  const id = z.uuid().safeParse(text(form, "id"));
  const status = z
    .enum(["ACTIVE", "ACHIEVED", "NO_LONGER_PRIORITY"])
    .safeParse(text(form, "status"));
  if (!id.success || !status.success) return;
  const supabase = await createClient();
  await supabase
    .from("mi_golf_objectives" as never)
    .update({ status: status.data } as never)
    .eq("id", id.data)
    .eq("user_id", user.id);
  revalidatePath("/mi-golf");
}
