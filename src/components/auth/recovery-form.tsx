"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Field, FormMessage } from "@/components/auth/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  requestPasswordRecoveryAction,
  type FormResult,
} from "@/lib/auth/actions";
import {
  recoveryRequestSchema,
  type RecoveryRequestValues,
} from "@/lib/auth/validation";

export function RecoveryForm() {
  const [result, setResult] = useState<FormResult>({ status: "idle" });
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RecoveryRequestValues>({
    resolver: zodResolver(recoveryRequestSchema),
    defaultValues: { email: "" },
  });

  function onSubmit(values: RecoveryRequestValues) {
    startTransition(async () => {
      setResult(await requestPasswordRecoveryAction(values));
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <FormMessage result={result} />
      <Field id="email" label="Correo electrónico" error={errors.email}>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...register("email")}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Enviando instrucciones…" : "Enviar instrucciones"}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        <Link
          href="/iniciar-sesion"
          className="text-foreground font-medium underline underline-offset-4"
        >
          Volver a iniciar sesión
        </Link>
      </p>
    </form>
  );
}
