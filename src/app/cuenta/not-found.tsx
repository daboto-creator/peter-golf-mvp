import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function AccountNotFound() {
  return (
    <section className="border-border rounded-[20px] border bg-white px-6 py-14 text-center sm:px-10 sm:py-16">
      <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
        Mi Golf
      </p>
      <h1 className="font-heading text-pg-black mt-4 text-3xl font-bold sm:text-4xl">
        No encontramos esta información
      </h1>
      <p className="text-muted-foreground mx-auto mt-4 max-w-xl leading-7">
        Es posible que el registro ya no esté disponible o que no pertenezca a
        tu cuenta.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/cuenta">Volver a Mi Golf</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/cuenta/pedidos">Ver mis pedidos</Link>
        </Button>
      </div>
    </section>
  );
}
