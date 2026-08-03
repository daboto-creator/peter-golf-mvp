import type { Metadata } from "next";

import { ProfileForm } from "@/components/auth/profile-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAuthenticatedUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Mi perfil | Peter Golf",
};

export default async function ProfilePage() {
  const user = await requireAuthenticatedUser("/cuenta/perfil");
  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("first_name,last_name,phone,created_at")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Mi perfil</h1>
        <p className="text-muted-foreground mt-2">
          Mantén actualizados tu nombre y apellido.
        </p>
      </div>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Información personal</CardTitle>
          <CardDescription>
            Sólo tú puedes consultar y modificar estos datos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error || !profile ? (
            <Alert variant="destructive">
              <AlertDescription>
                No pudimos cargar tu perfil. Inténtalo de nuevo más tarde.
              </AlertDescription>
            </Alert>
          ) : (
            <ProfileForm
              firstName={profile.first_name ?? ""}
              lastName={profile.last_name ?? ""}
              email={user.email ?? ""}
              phone={profile.phone ?? ""}
            />
          )}
          {profile?.created_at ? (
            <p className="text-muted-foreground mt-6 border-t pt-4 text-sm">
              Cuenta creada el{" "}
              {new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(
                new Date(profile.created_at),
              )}
              .
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
