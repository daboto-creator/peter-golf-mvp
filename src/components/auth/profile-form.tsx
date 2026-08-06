"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Field, FormMessage } from "@/components/auth/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProfileAction } from "@/lib/auth/actions";
import type { FormResult } from "@/lib/auth/auth-action-state";
import { profileSchema, type ProfileValues } from "@/lib/auth/validation";

export function ProfileForm({
  firstName,
  lastName,
  email,
  phone,
}: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}) {
  const [result, setResult] = useState<FormResult>({ status: "idle" });
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { firstName, lastName, phone },
  });

  function onSubmit(values: ProfileValues) {
    startTransition(async () => {
      setResult(await updateProfileAction(values));
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <FormMessage result={result} />
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
      <Field id="email" label="Correo electrónico">
        <Input id="email" type="email" value={email} disabled readOnly />
      </Field>
      <Field id="phone" label="Teléfono" error={errors.phone}>
        <Input
          id="phone"
          type="tel"
          autoComplete="tel"
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={errors.phone ? "phone-error" : undefined}
          {...register("phone")}
        />
      </Field>
      <p className="text-muted-foreground text-sm">
        El correo electrónico no puede cambiarse en esta etapa.
      </p>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}
