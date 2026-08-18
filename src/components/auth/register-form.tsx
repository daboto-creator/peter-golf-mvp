"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Field, FormMessage } from "@/components/auth/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registerAction } from "@/lib/auth/actions";
import type { FormResult } from "@/lib/auth/auth-action-state";
import { registerSchema, type RegisterValues } from "@/lib/auth/validation";

export function RegisterForm() {
  const [result, setResult] = useState<FormResult>({ status: "idle" });
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      passwordConfirmation: "",
      acceptedTerms: false,
    },
  });

  function onSubmit(values: RegisterValues) {
    startTransition(async () => {
      setResult(await registerAction(values));
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <FormMessage result={result} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="firstName" label="Nombre" error={errors.firstName}>
          <Input
            id="firstName"
            autoComplete="given-name"
            aria-invalid={Boolean(errors.firstName)}
            aria-describedby={errors.firstName ? "firstName-error" : undefined}
            {...register("firstName")}
          />
        </Field>
        <Field id="lastName" label="Apellido" error={errors.lastName}>
          <Input
            id="lastName"
            autoComplete="family-name"
            aria-invalid={Boolean(errors.lastName)}
            aria-describedby={errors.lastName ? "lastName-error" : undefined}
            {...register("lastName")}
          />
        </Field>
      </div>
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
      <Field id="password" label="Contraseña" error={errors.password}>
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
        label="Confirmar contraseña"
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
      <div className="space-y-2">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="border-input mt-0.5 size-4 rounded"
            aria-invalid={Boolean(errors.acceptedTerms)}
            aria-describedby={
              errors.acceptedTerms ? "acceptedTerms-error" : undefined
            }
            {...register("acceptedTerms")}
          />
          <span>Acepto el aviso de privacidad y los términos de uso.</span>
        </label>
        {errors.acceptedTerms ? (
          <p
            id="acceptedTerms-error"
            className="text-destructive text-sm"
            role="alert"
          >
            {errors.acceptedTerms.message}
          </p>
        ) : null}
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Creando acceso…" : "Crear Mi Golf"}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        ¿Ya tienes cuenta?{" "}
        <Link
          href="/iniciar-sesion"
          className="text-foreground font-medium underline underline-offset-4"
        >
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
