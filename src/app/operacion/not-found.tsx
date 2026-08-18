import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function OperationsNotFound() {
  return (
    <section className="border-border rounded-[20px] border bg-white px-6 py-14 text-center sm:px-10 sm:py-16">
      <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
        Operaciones
      </p>
      <h1 className="text-pg-black mt-4 text-3xl font-semibold tracking-[-0.03em]">
        No encontramos este registro
      </h1>
      <p className="text-muted-foreground mx-auto mt-4 max-w-xl leading-7">
        El recurso puede haber cambiado de estado o ya no estar disponible para
        esta operación.
      </p>
      <Button asChild className="mt-7">
        <Link href="/operacion">Volver a Operaciones</Link>
      </Button>
    </section>
  );
}
