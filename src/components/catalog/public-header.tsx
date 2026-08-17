import Image from "next/image";
import Link from "next/link";
import { ShoppingBag, UserRound } from "lucide-react";

export function PublicHeader() {
  return (
    <header className="border-border/80 sticky top-0 z-50 border-b bg-white/95 backdrop-blur-md">
      <div className="bg-pg-black text-white">
        <div className="mx-auto flex min-h-8 max-w-7xl items-center justify-center gap-3 px-4 py-1.5 text-center text-[0.62rem] font-semibold tracking-[0.12em] uppercase sm:justify-between sm:px-6 lg:px-8">
          <span>Envíos a todo México</span>
          <span className="text-pg-gold" aria-hidden="true">
            •
          </span>
          <span>Equipo nuevo y seminuevo</span>
          <span className="hidden sm:inline">
            Compra con asesoría y confianza
          </span>
        </div>
      </div>

      <div className="mx-auto flex min-h-[5.25rem] max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:min-h-24 sm:px-6 lg:px-8">
        <Link
          href="/"
          aria-label="Peter Golf Pro Shop, inicio"
          className="shrink-0 rounded-lg focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none"
        >
          <Image
            src="/logos/peter-golf-pro-shop.jpg"
            alt="Peter Golf Pro Shop"
            width={375}
            height={282}
            className="h-auto w-[5.5rem] sm:w-[6.75rem]"
          />
        </Link>
        <nav
          aria-label="Navegación pública"
          className="flex items-center gap-1 text-sm font-semibold sm:gap-2"
        >
          <Link
            href="/productos"
            className="hover:bg-pg-warm-white hover:text-pg-gold hidden min-h-11 items-center rounded-xl px-3.5 transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none sm:inline-flex"
          >
            Pro Shop
          </Link>
          <Link
            href="/carrito"
            className="hover:bg-pg-warm-white hover:text-pg-gold inline-flex min-h-11 items-center gap-2 rounded-xl px-2.5 transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none sm:px-3.5"
          >
            <ShoppingBag aria-hidden="true" className="size-[1.1rem]" />
            <span className="sr-only sm:not-sr-only">Mi Bolsa</span>
          </Link>
          <Link
            href="/cuenta"
            className="hover:bg-pg-warm-white hover:text-pg-gold inline-flex min-h-11 items-center gap-2 rounded-xl px-2.5 transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none sm:px-3.5"
          >
            <UserRound aria-hidden="true" className="size-[1.1rem]" />
            <span className="sr-only sm:not-sr-only">Mi Golf</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
