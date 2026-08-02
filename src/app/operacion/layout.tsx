import Link from "next/link";

import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/auth/actions";
import { requireCatalogManager } from "@/lib/auth/catalog-authorization";

export const dynamic = "force-dynamic";

export default async function OperationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireCatalogManager("/operacion");

  return (
    <div className="bg-muted/30 min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/operacion"
              className="focus-visible:ring-ring rounded-sm text-lg font-semibold focus-visible:ring-2 focus-visible:outline-none"
            >
              Peter Golf · Operación
            </Link>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 lg:hidden">
              Área protegida
            </span>
          </div>
          <nav
            aria-label="Navegación de operación"
            className="flex flex-wrap items-center gap-2"
          >
            <Button asChild variant="ghost">
              <Link href="/operacion/pedidos">Pedidos</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/operacion/catalogo">Catálogo</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/operacion/inventario">Inventario</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/operacion/taxonomias">Taxonomías</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/productos">Catálogo público</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/cuenta">Mi cuenta</Link>
            </Button>
            <form action={logoutAction}>
              <Button type="submit" variant="outline">
                Cerrar sesión
              </Button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {children}
      </main>
    </div>
  );
}
