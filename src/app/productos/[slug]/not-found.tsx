import Link from "next/link";

export default function ProductNotFound() {
  return (
    <main className="bg-muted/30 flex min-h-screen items-center justify-center px-4 py-16">
      <div className="max-w-lg rounded-2xl border bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-emerald-800">
          Producto no disponible
        </p>
        <h1 className="mt-3 text-2xl font-semibold">
          No encontramos este producto
        </h1>
        <p className="text-muted-foreground mt-3 leading-6">
          Es posible que aún no esté publicado o que ya no forme parte del
          catálogo visible.
        </p>
        <Link
          href="/productos"
          className="bg-primary text-primary-foreground mt-6 inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium"
        >
          Ver productos
        </Link>
      </div>
    </main>
  );
}
