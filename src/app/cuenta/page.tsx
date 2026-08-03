import type { Metadata } from "next";
import Link from "next/link";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAuthenticatedUser } from "@/lib/auth/user";

export const metadata: Metadata = {
  title: "Mi cuenta | Peter Golf",
};

type SearchParams = Promise<{ confirmado?: string | string[] }>;

export default async function AccountPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [user, query] = await Promise.all([
    requireAuthenticatedUser("/cuenta"),
    searchParams,
  ]);

  return (
    <div className="space-y-6">
      {query.confirmado === "1" ? (
        <Alert variant="success">
          <AlertDescription>
            Tu correo quedó confirmado y tu sesión está activa.
          </AlertDescription>
        </Alert>
      ) : null}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Mi cuenta</h1>
        <p className="text-muted-foreground mt-2">
          Administra tus datos básicos y tu sesión.
        </p>
      </div>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Datos de acceso</CardTitle>
          <CardDescription>
            Correo confirmado con Supabase Auth.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm break-all">{user.email}</p>
          <Button asChild>
            <Link href="/cuenta/perfil">Editar perfil</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/cuenta/pedidos">Ver mis pedidos</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
