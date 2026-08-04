import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Peter Golf Pro Shop | Equipo y asesoría de golf",
  description:
    "Equipo de golf nuevo y seminuevo con acompañamiento profesional para elegir con confianza.",
};

const pillars = [
  {
    title: "Equipo nuevo y seminuevo",
    description:
      "Alternativas descritas con su condición y características relevantes.",
  },
  {
    title: "Asesoría profesional",
    description:
      "Acompañamiento para comparar opciones de acuerdo con tus necesidades.",
  },
  {
    title: "Disponibilidad transparente",
    description:
      "Información clara cuando un producto está disponible o requiere confirmación.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-950">
      <header className="border-b border-stone-200 bg-white/95">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <Link
            href="/"
            className="focus-visible:ring-ring w-fit rounded-sm text-lg font-semibold tracking-tight focus-visible:ring-2 focus-visible:outline-none"
          >
            Peter Golf Pro Shop
          </Link>
          <nav aria-label="Navegación principal" className="flex gap-2">
            <Button asChild variant="ghost">
              <Link href="/productos">Productos</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/iniciar-sesion">Iniciar sesión</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="border-b border-stone-200 bg-linear-to-br from-emerald-950 via-emerald-900 to-stone-900 text-white">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1.25fr_0.75fr] lg:items-end lg:px-8 lg:py-32">
            <div className="max-w-3xl">
              <p className="text-sm font-medium tracking-[0.18em] text-emerald-200 uppercase">
                Equipo para jugar con confianza
              </p>
              <h1 className="mt-5 text-4xl leading-tight font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                Peter Golf Pro Shop
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-emerald-50 sm:text-xl">
                Encuentra equipo de golf nuevo y seminuevo con asesoría
                profesional para entender cada opción y elegir la que mejor se
                adapte a tu juego.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/productos">Explorar productos</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/40 bg-transparent text-white hover:bg-white hover:text-emerald-950"
                >
                  <Link href="/iniciar-sesion">Acceder a mi cuenta</Link>
                </Button>
              </div>
            </div>

            <aside className="rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-sm">
              <p className="text-sm font-medium text-emerald-200">
                Una compra mejor informada
              </p>
              <p className="mt-3 leading-7 text-emerald-50">
                Revisamos condición, precio y disponibilidad con claridad. Si
                una opción requiere confirmación, lo indicamos antes de que
                tomes una decisión.
              </p>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-medium tracking-wide text-emerald-800 uppercase">
              Nuestro enfoque
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              Opciones claras, acompañamiento cercano
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {pillars.map(({ title, description }) => (
              <article
                key={title}
                className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
              >
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-3 leading-7 text-stone-600">{description}</p>
              </article>
            ))}
          </div>
          <div className="mt-10">
            <Button asChild variant="outline" size="lg">
              <Link href="/productos">Ver catálogo</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
