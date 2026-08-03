"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { publicEnv } from "@/env/public";
import { getSafeInternalPath } from "@/lib/auth/redirect";
import {
  loginSchema,
  profileSchema,
  recoveryRequestSchema,
  registerSchema,
  updatePasswordSchema,
  type LoginValues,
  type ProfileValues,
  type RecoveryRequestValues,
  type RegisterValues,
  type UpdatePasswordValues,
} from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

export type FormResult = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

function validationResult(error: {
  flatten: () => { fieldErrors: Record<string, string[]> };
}): FormResult {
  return {
    status: "error",
    message: "Revisa los campos marcados.",
    errors: error.flatten().fieldErrors,
  };
}

export async function registerAction(
  values: RegisterValues,
): Promise<FormResult> {
  const parsed = registerSchema.safeParse(values);

  if (!parsed.success) {
    return validationResult(parsed.error);
  }

  try {
    const supabase = await createClient();
    const callbackUrl = new URL(
      "/auth/callback",
      publicEnv.NEXT_PUBLIC_APP_URL,
    );
    callbackUrl.searchParams.set("next", "/cuenta");

    await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: callbackUrl.toString(),
        data: {
          first_name: parsed.data.firstName,
          last_name: parsed.data.lastName,
        },
      },
    });
  } catch {
    // Keep the response indistinguishable from an existing-address response.
  }

  return {
    status: "success",
    message:
      "Si es posible crear la cuenta, recibirás un correo para confirmarla. Revisa también tu carpeta de correo no deseado.",
  };
}

export async function loginAction(values: LoginValues): Promise<FormResult> {
  const parsed = loginSchema.safeParse(values);

  if (!parsed.success) {
    return validationResult(parsed.error);
  }

  let authenticated = false;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    authenticated = !error;
  } catch {
    authenticated = false;
  }

  if (!authenticated) {
    return {
      status: "error",
      message:
        "No pudimos iniciar sesión. Revisa tus datos o confirma tu correo e inténtalo de nuevo.",
    };
  }

  redirect(getSafeInternalPath(parsed.data.next));
}

export async function logoutAction() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } finally {
    redirect("/iniciar-sesion?sesion=cerrada");
  }
}

export async function requestPasswordRecoveryAction(
  values: RecoveryRequestValues,
): Promise<FormResult> {
  const parsed = recoveryRequestSchema.safeParse(values);

  if (!parsed.success) {
    return validationResult(parsed.error);
  }

  try {
    const supabase = await createClient();
    const callbackUrl = new URL(
      "/auth/callback",
      publicEnv.NEXT_PUBLIC_APP_URL,
    );
    callbackUrl.searchParams.set("next", "/actualizar-contrasena");

    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: callbackUrl.toString(),
    });
  } catch {
    // Recovery requests intentionally return the same result in every case.
  }

  return {
    status: "success",
    message:
      "Si existe una cuenta con ese correo, recibirás instrucciones para restablecer tu contraseña.",
  };
}

export async function updatePasswordAction(
  values: UpdatePasswordValues,
): Promise<FormResult> {
  const parsed = updatePasswordSchema.safeParse(values);

  if (!parsed.success) {
    return validationResult(parsed.error);
  }

  const cookieStore = await cookies();

  if (cookieStore.get("pg-password-recovery")?.value !== "1") {
    return {
      status: "error",
      message:
        "El enlace de recuperación no es válido o ya venció. Solicita uno nuevo.",
    };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (!user || userError) {
      return {
        status: "error",
        message:
          "El enlace de recuperación no es válido o ya venció. Solicita uno nuevo.",
      };
    }

    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });

    if (error) {
      return {
        status: "error",
        message:
          "No pudimos actualizar la contraseña. Solicita un enlace nuevo e inténtalo otra vez.",
      };
    }

    await supabase.auth.signOut();
    cookieStore.delete("pg-password-recovery");
  } catch {
    return {
      status: "error",
      message:
        "No pudimos actualizar la contraseña. Inténtalo de nuevo más tarde.",
    };
  }

  redirect("/iniciar-sesion?contrasena=actualizada");
}

export async function updateProfileAction(
  values: ProfileValues,
): Promise<FormResult> {
  const parsed = profileSchema.safeParse(values);

  if (!parsed.success) {
    return validationResult(parsed.error);
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (!user || userError) {
      return {
        status: "error",
        message: "Tu sesión ya no es válida. Vuelve a iniciar sesión.",
      };
    }

    const { error } = await supabase.rpc("update_customer_profile", {
      requested_first_name: parsed.data.firstName,
      requested_last_name: parsed.data.lastName,
      requested_phone: parsed.data.phone,
    });

    if (error) {
      return {
        status: "error",
        message: "No pudimos guardar tus cambios. Inténtalo de nuevo.",
      };
    }
  } catch {
    return {
      status: "error",
      message: "No pudimos guardar tus cambios. Inténtalo de nuevo.",
    };
  }

  revalidatePath("/cuenta/perfil");
  return {
    status: "success",
    message: "Tu perfil se actualizó correctamente.",
  };
}
