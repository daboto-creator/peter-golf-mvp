import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function Forbidden() {
  return (
    <main className="bg-muted/30 flex min-h-screen items-center justify-center px-4 py-16">
      <section className="w-full max-w-lg rounded-2xl border bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium tracking-wide text-red-700 uppercase">
          Acceso 403
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          No tienes permiso para entrar
        </h1>
        <p className="text-muted-foreground mt-4 leading-7">
          Tu sesión está activa, pero esta área está reservada para personal
          autorizado de operación.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/cuenta">Volver a mi cuenta</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/productos">Ver catálogo público</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
