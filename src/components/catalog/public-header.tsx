import Link from "next/link";

export function PublicHeader() {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="rounded-sm text-lg font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          Peter Golf
        </Link>
        <nav
          aria-label="Navegación pública"
          className="flex items-center gap-4 text-sm font-medium"
        >
          <Link
            href="/productos"
            className="underline-offset-4 hover:underline"
          >
            Productos
          </Link>
          <Link href="/carrito" className="underline-offset-4 hover:underline">
            Carrito
          </Link>
          <Link href="/cuenta" className="underline-offset-4 hover:underline">
            Mi cuenta
          </Link>
        </nav>
      </div>
    </header>
  );
}
