import { ClipboardList, MapPin, UserRound, Wrench } from "lucide-react";
import Link from "next/link";

import { PublicFooter } from "@/components/catalog/public-footer";
import { PublicHeader } from "@/components/catalog/public-header";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/auth/actions";
import { canCurrentUserManageCatalog } from "@/lib/auth/catalog-authorization";

export const dynamic = "force-dynamic";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const canManageCatalog = await canCurrentUserManageCatalog();

  return (
    <div className="bg-pg-warm-white min-h-screen" data-account-shell>
      <PublicHeader />
      <div className="border-border border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <p className="hidden shrink-0 text-xs font-semibold tracking-[0.16em] uppercase md:block">
            Mi Golf
          </p>
          <nav
            aria-label="Mi Golf"
            className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-2"
          >
            <Button asChild variant="ghost" className="shrink-0">
              <Link href="/cuenta">
                <UserRound aria-hidden="true" />
                Resumen
              </Link>
            </Button>
            <Button asChild variant="ghost" className="shrink-0">
              <Link href="/cuenta/perfil">Perfil</Link>
            </Button>
            <Button asChild variant="ghost" className="shrink-0">
              <Link href="/cuenta/direcciones">
                <MapPin aria-hidden="true" />
                Direcciones
              </Link>
            </Button>
            <Button asChild variant="ghost" className="shrink-0">
              <Link href="/cuenta/pedidos">
                <ClipboardList aria-hidden="true" />
                Pedidos
              </Link>
            </Button>
            {canManageCatalog ? (
              <Button asChild variant="ghost" className="shrink-0">
                <Link href="/operacion">
                  <Wrench aria-hidden="true" />
                  Operación
                </Link>
              </Button>
            ) : null}
          </nav>
          <form action={logoutAction} className="shrink-0">
            <Button type="submit" variant="outline" size="sm">
              Cerrar sesión
            </Button>
          </form>
        </div>
      </div>
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
