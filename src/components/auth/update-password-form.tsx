"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Field, FormMessage } from "@/components/auth/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updatePasswordAction, type FormResult } from "@/lib/auth/actions";
import {
  updatePasswordSchema,
  type UpdatePasswordValues,
} from "@/lib/auth/validation";

export function UpdatePasswordForm() {
  const [result, setResult] = useState<FormResult>({ status: "idle" });
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdatePasswordValues>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: { password: "", passwordConfirmation: "" },
  });

  function onSubmit(values: UpdatePasswordValues) {
    startTransition(async () => {
      setResult(await updatePasswordAction(values));
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <FormMessage result={result} />
      <Field id="password" label="Nueva contraseña" error={errors.password}>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "password-error" : undefined}
          {...register("password")}
        />
      </Field>
      <Field
        id="passwordConfirmation"
        label="Confirmar nueva contraseña"
        error={errors.passwordConfirmation}
      >
        <Input
          id="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.passwordConfirmation)}
          aria-describedby={
            errors.passwordConfirmation
              ? "passwordConfirmation-error"
              : undefined
          }
          {...register("passwordConfirmation")}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Actualizando…" : "Guardar nueva contraseña"}
      </Button>
    </form>
  );
}
