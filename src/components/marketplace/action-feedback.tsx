"use client";

import { useFormStatus } from "react-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { PartnerActionState } from "@/lib/marketplace/partner-action-state";

export function ActionFeedback({ state }: { state: PartnerActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <Alert variant={state.status === "error" ? "destructive" : "success"}>
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}

export function SubmitButton({
  children,
  disabled = false,
}: {
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? "Guardando…" : children}
    </Button>
  );
}
