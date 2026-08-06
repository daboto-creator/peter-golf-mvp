"use client";

import type { FieldError } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import type { FormResult } from "@/lib/auth/auth-action-state";

export function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: FieldError;
  children: React.ReactNode;
}) {
  const errorId = `${id}-error`;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={errorId} className="text-destructive text-sm" role="alert">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}

export function FormMessage({ result }: { result: FormResult }) {
  if (!result.message) {
    return null;
  }

  return (
    <Alert
      variant={result.status === "success" ? "success" : "destructive"}
      aria-live="polite"
    >
      <AlertDescription>{result.message}</AlertDescription>
    </Alert>
  );
}
