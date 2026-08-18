import Link from "next/link";

import { PublicFooter } from "@/components/catalog/public-footer";
import { PublicHeader } from "@/components/catalog/public-header";
import { Button } from "@/components/ui/button";

export default function Forbidden() {
  return (
    <div className="bg-pg-warm-white min-h-screen">
      <PublicHeader />
      <main className="mx-auto flex min-h-[60vh] max-w-3xl items-center px-4 py-20 sm:px-6">
        <section className="border-border w-full border-y py-12 text-center">
          <p className="text-destructive text-xs font-semibold tracking-[0.18em] uppercase">
            Acceso restringido
          </p>
          <h1 className="font-heading text-pg-black mt-4 text-3xl font-bold sm:text-4xl">
            No tienes permiso para entrar
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl leading-7">
            Tu sesión está activa, pero esta área está reservada para personal
            autorizado de Operaciones.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/cuenta">Volver a Mi Golf</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/productos">Ver el Pro Shop</Link>
            </Button>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
