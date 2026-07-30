import Link from "next/link";

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
    <div className="bg-muted/30 min-h-screen">
      <header className="bg-background border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="focus-visible:ring-ring rounded-sm text-lg font-semibold focus-visible:ring-2 focus-visible:outline-none"
          >
            Peter Golf
          </Link>
          <nav aria-label="Cuenta" className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link href="/cuenta">Cuenta</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/cuenta/perfil">Perfil</Link>
            </Button>
            {canManageCatalog ? (
              <Button asChild variant="ghost">
                <Link href="/operacion">Operación</Link>
              </Button>
            ) : null}
            <form action={logoutAction}>
              <Button type="submit" variant="outline">
                Cerrar sesión
              </Button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}
