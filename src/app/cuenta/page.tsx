import type { Metadata } from "next";
import Image from "next/image";
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
  title: "Mi Golf | Best Round Pro Shop",
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
    <div className="space-y-10">
      {query.confirmado === "1" ? (
        <Alert variant="success">
          <AlertDescription>
            Tu correo quedó confirmado y tu sesión está activa.
          </AlertDescription>
        </Alert>
      ) : null}
      <section className="bg-pg-black grid overflow-hidden rounded-[20px] text-white lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-col justify-center px-6 py-10 sm:px-10 sm:py-12 lg:px-14">
          <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
            Área del golfista
          </p>
          <h1 className="font-heading mt-4 text-4xl font-bold tracking-[-0.035em] sm:text-5xl">
            Mi Golf
          </h1>
          <p className="mt-5 max-w-lg leading-7 text-white/70">
            Administra tu perfil, direcciones y pedidos con la misma claridad
            con la que eliges tu equipo.
          </p>
        </div>
        <figure className="relative min-h-64 lg:min-h-[22rem]">
          <Image
            src="/images/home/advice-fitting-temporary.jpg"
            alt="Golfista revisando un palo con asesoría especializada"
            fill
            sizes="(max-width: 1023px) calc(100vw - 2rem), 55vw"
            className="object-cover object-center"
          />
          <figcaption className="absolute right-4 bottom-4 rounded-lg bg-black/65 px-3 py-2 text-[0.65rem] tracking-[0.12em] uppercase">
            Imagen editorial
          </figcaption>
        </figure>
      </section>

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Datos de acceso</CardTitle>
            <CardDescription>
              Tu correo de acceso a Best Round Pro Shop.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm break-all">{user.email}</p>
            <Button asChild>
              <Link href="/cuenta/perfil">Editar perfil</Link>
            </Button>
          </CardContent>
        </Card>
        <div className="grid gap-5 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Direcciones</CardTitle>
              <CardDescription>
                Mantén listos tus datos de entrega.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/cuenta/direcciones">Administrar direcciones</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Mis pedidos</CardTitle>
              <CardDescription>
                Consulta estados, pagos y detalles.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/cuenta/pedidos">Ver mis pedidos</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
