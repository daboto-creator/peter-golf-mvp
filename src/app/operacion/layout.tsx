import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/auth/actions";
import { requireCatalogManager } from "@/lib/auth/catalog-authorization";
import { BRAND_NAME } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function OperationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireCatalogManager("/operacion");

  return (
    <div className="bg-pg-warm-white min-h-screen" data-operations-shell>
      <header className="border-pg-gold/35 bg-pg-black border-b text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/operacion"
              className="focus-visible:ring-pg-gold flex items-center gap-3 rounded-xl focus-visible:ring-2 focus-visible:outline-none"
            >
              <BrandLogo background="dark" className="w-16" />
              <span>
                <span className="block text-xs tracking-[0.14em] text-white/55 uppercase">
                  {BRAND_NAME}
                </span>
                <span className="block text-sm font-semibold">Operaciones</span>
              </span>
            </Link>
            <span className="border-pg-gold/40 text-pg-gold rounded-lg border px-2.5 py-1 text-xs font-medium lg:hidden">
              Área protegida
            </span>
          </div>
          <nav
            aria-label="Navegación de operación"
            className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0"
          >
            <Button
              asChild
              variant="ghost"
              className="shrink-0 text-white/75 hover:bg-white/10 hover:text-white"
            >
              <Link href="/operacion/marketplace/partners">Partners</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="shrink-0 text-white/75 hover:bg-white/10 hover:text-white"
            >
              <Link href="/operacion/marketplace/publicaciones">
                Publicaciones Partner
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="shrink-0 text-white/75 hover:bg-white/10 hover:text-white"
            >
              <Link href="/operacion/marketplace/precios">Pricing Partner</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="shrink-0 text-white/75 hover:bg-white/10 hover:text-white"
            >
              <Link href="/operacion/marketplace/ordenes">Órdenes Partner</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="shrink-0 text-white/75 hover:bg-white/10 hover:text-white"
            >
              <Link href="/operacion/pedidos">Pedidos</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="shrink-0 text-white/75 hover:bg-white/10 hover:text-white"
            >
              <Link href="/operacion/notificaciones">Notificaciones</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="shrink-0 text-white/75 hover:bg-white/10 hover:text-white"
            >
              <Link href="/operacion/catalogo">Catálogo</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="shrink-0 text-white/75 hover:bg-white/10 hover:text-white"
            >
              <Link href="/operacion/inventario">Inventario</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="shrink-0 text-white/75 hover:bg-white/10 hover:text-white"
            >
              <Link href="/operacion/taxonomias">Taxonomías</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="shrink-0 text-white/75 hover:bg-white/10 hover:text-white"
            >
              <Link href="/productos">Catálogo público</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="shrink-0 text-white/75 hover:bg-white/10 hover:text-white"
            >
              <Link href="/cuenta">Mi Golf</Link>
            </Button>
            <form action={logoutAction}>
              <Button
                type="submit"
                variant="outline"
                className="hover:text-pg-black shrink-0 border-white/25 bg-transparent text-white hover:bg-white"
              >
                Cerrar sesión
              </Button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        {children}
      </main>
    </div>
  );
}
