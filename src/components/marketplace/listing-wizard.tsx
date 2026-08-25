import Link from "next/link";

import { Button } from "@/components/ui/button";

const steps = [
  ["producto", "Producto"],
  ["fotos", "Fotos"],
  ["detalles", "Detalles"],
  ["condicion", "Condición"],
  ["inventario", "Inventario"],
  ["revision", "Revisión"],
] as const;

export function ListingWizardHeader({
  listingId,
  current,
  title,
}: {
  listingId: string;
  current: (typeof steps)[number][0];
  title: string;
}) {
  const index = steps.findIndex(([slug]) => slug === current);
  return (
    <header className="space-y-5">
      <div>
        <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
          Paso {index + 1} de {steps.length}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
          {title}
        </h1>
      </div>
      <nav
        aria-label="Progreso de la publicación"
        className="overflow-x-auto pb-2"
      >
        <ol className="flex min-w-max gap-2">
          {steps.map(([slug, label], stepIndex) => (
            <li key={slug}>
              <Button
                asChild
                size="sm"
                variant={slug === current ? "default" : "outline"}
              >
                <Link href={`/partner/publicaciones/${listingId}/${slug}`}>
                  <span aria-hidden="true">{stepIndex + 1}.</span> {label}
                </Link>
              </Button>
            </li>
          ))}
        </ol>
      </nav>
    </header>
  );
}
