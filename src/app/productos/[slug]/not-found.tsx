import Link from "next/link";

import { PublicFooter } from "@/components/catalog/public-footer";
import { PublicHeader } from "@/components/catalog/public-header";

export default function ProductNotFound() {
  return (
    <div className="bg-pg-warm-white min-h-screen">
      <PublicHeader />
      <main className="mx-auto flex min-h-[60vh] max-w-3xl items-center px-4 py-20 sm:px-6">
        <section className="border-border w-full border-y py-12 text-center">
          <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
            Producto no disponible
          </p>
          <h1 className="font-heading text-pg-black mt-4 text-3xl font-bold sm:text-4xl">
            No encontramos este producto
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl leading-7">
            Es posible que aún no esté publicado o que ya no forme parte del
            catálogo visible.
          </p>
          <Link
            href="/productos"
            className="bg-pg-black focus-visible:ring-pg-gold mt-7 inline-flex min-h-11 items-center rounded-xl px-6 text-sm font-semibold text-white transition-colors duration-200 hover:bg-pg-black-soft focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Volver al Pro Shop
          </Link>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
