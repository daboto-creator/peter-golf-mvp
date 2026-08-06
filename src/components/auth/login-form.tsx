"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Field, FormMessage } from "@/components/auth/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginAction } from "@/lib/auth/actions";
import type { FormResult } from "@/lib/auth/auth-action-state";
import { loginSchema, type LoginValues } from "@/lib/auth/validation";

export function LoginForm({ next }: { next: string }) {
  const [result, setResult] = useState<FormResult>({ status: "idle" });
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", next },
  });

  function onSubmit(values: LoginValues) {
    startTransition(async () => {
      setResult(await loginAction(values));
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
      <Field id="password" label="Contraseña" error={errors.password}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "password-error" : undefined}
          {...register("password")}
        />
      </Field>
      <input type="hidden" {...register("next")} />
      <div className="flex justify-end">
        <Link
          href="/recuperar-contrasena"
          className="text-sm font-medium underline underline-offset-4"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Iniciando sesión…" : "Iniciar sesión"}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        ¿Aún no tienes cuenta?{" "}
        <Link
          href="/registro"
          className="text-foreground font-medium underline underline-offset-4"
        >
          Crea una
        </Link>
      </p>
    </form>
  );
}
