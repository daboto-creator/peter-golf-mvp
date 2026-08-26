"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import type { PartnerActionState } from "@/lib/marketplace/partner-action-state";

const initial: PartnerActionState = { status: "idle", message: "" };

export function PayoutActionForm({
  action,
  hidden,
  label,
  fields = [],
  destructive = false,
}: {
  action: (
    state: PartnerActionState,
    data: FormData,
  ) => Promise<PartnerActionState>;
  hidden: Record<string, string>;
  label: string;
  fields?: {
    name: string;
    label: string;
    type?: "text" | "date" | "number" | "textarea";
    required?: boolean;
    defaultValue?: string | number;
  }[];
  destructive?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form
      action={formAction}
      className="space-y-3 rounded-xl border bg-white p-4"
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {fields.map((field) => (
        <label key={field.name} className="block text-sm font-medium">
          {field.label}
          {field.type === "textarea" ? (
            <textarea
              name={field.name}
              required={field.required}
              defaultValue={field.defaultValue}
              className="border-input mt-2 min-h-24 w-full rounded-xl border p-3"
            />
          ) : (
            <input
              name={field.name}
              type={field.type ?? "text"}
              required={field.required}
              defaultValue={field.defaultValue}
              className="border-input mt-2 h-11 w-full rounded-xl border px-3"
            />
          )}
        </label>
      ))}
      <Button
        type="submit"
        disabled={pending}
        variant={destructive ? "destructive" : "outline"}
      >
        {pending ? "Procesando…" : label}
      </Button>
      {state.status !== "idle" ? (
        <p
          role="status"
          className={
            state.status === "error"
              ? "text-destructive text-sm"
              : "text-sm text-emerald-700"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
