import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { BRAND_NAME } from "@/lib/brand";

const shopLinks = [{ href: "/productos", label: "Pro Shop" }];

const golferLinks = [
  { href: "/carrito", label: "Mi Bolsa" },
  { href: "/cuenta", label: "Mi Golf" },
  { href: "/iniciar-sesion", label: "Iniciar sesión" },
];

export function PublicFooter() {
  return (
    <footer className="bg-pg-black border-pg-gold/45 border-t text-white">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 sm:py-16 md:grid-cols-2 lg:grid-cols-[1.35fr_0.65fr_0.75fr_1fr] lg:gap-16 lg:px-8">
        <div className="max-w-sm">
          <BrandLogo background="dark" className="w-32 sm:w-36" />
          <p className="mt-4 text-sm leading-7 text-white/65">
            Equipo nuevo y seminuevo con criterio, transparencia y asesoría para
            comprar con confianza.
          </p>
          <p className="mt-6 text-xs tracking-wide text-white/45 uppercase">
            Querétaro · Envíos a todo México
          </p>
        </div>

        <nav
          aria-label={`Explorar ${BRAND_NAME}`}
          className="border-white/10 sm:border-l sm:pl-8 lg:border-l-0 lg:pl-0"
        >
          <h2 className="text-pg-gold text-xs font-semibold tracking-[0.16em] uppercase">
            Explora
          </h2>
          <ul className="mt-4 text-sm">
            {shopLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="focus-visible:ring-pg-gold hover:text-pg-gold inline-flex min-h-11 items-center rounded-lg text-white/75 transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Área del golfista">
          <h2 className="text-pg-gold text-xs font-semibold tracking-[0.16em] uppercase">
            Tu experiencia
          </h2>
          <ul className="mt-4 text-sm">
            {golferLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="focus-visible:ring-pg-gold hover:text-pg-gold inline-flex min-h-11 items-center rounded-lg text-white/75 transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-pg-gold text-xs font-semibold tracking-[0.16em] uppercase">
            Confianza
          </h2>
          <ul className="mt-5 space-y-3 text-sm leading-6 text-white/65">
            <li>Condición explicada con claridad</li>
            <li>Envíos a todo México</li>
            <li>Ayuda antes y después de comprar</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-5 text-xs text-white/45 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} {BRAND_NAME}
        </div>
      </div>
    </footer>
  );
}
