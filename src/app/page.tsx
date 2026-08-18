import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Check,
  Crosshair,
  Flag,
  Gift,
  MapPin,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Truck,
} from "lucide-react";

import { ProductCard } from "@/components/catalog/product-card";
import { PublicFooter } from "@/components/catalog/public-footer";
import { PublicHeader } from "@/components/catalog/public-header";
import { Button } from "@/components/ui/button";
import { listPublicProducts } from "@/lib/catalog/public-products";

export const metadata: Metadata = {
  title: "Peter Golf Pro Shop | Equipo elegido con criterio",
  description:
    "Equipo de golf nuevo y seminuevo con asesoría profesional para comprar con confianza en México.",
};

const shoppingPaths = [
  {
    number: "01",
    title: "Explorar el Pro Shop",
    description:
      "Ya sabes qué buscas. Explora nuestra selección de equipo y accesorios.",
    href: "/productos",
    status: null,
  },
  {
    number: "02",
    title: "Encuentra mi equipo",
    description: "Cuéntanos sobre tu juego y te ayudamos a reducir opciones.",
    href: null,
    status: "Próximamente",
  },
  {
    number: "03",
    title: "Hablar con un especialista",
    description:
      "Cuando quieras una segunda opinión, habla con alguien que conoce golf.",
    href: null,
    status: "Próximamente",
  },
];

const trustPoints = [
  { icon: ShieldCheck, label: "Condición transparente" },
  { icon: PackageCheck, label: "Equipo nuevo y seminuevo" },
  { icon: Truck, label: "Envíos a todo México" },
  { icon: MapPin, label: "Atención desde Querétaro" },
];

const improvementGoals = [
  { icon: Target, label: "Más distancia" },
  { icon: Crosshair, label: "Mayor precisión" },
  { icon: Flag, label: "Mejor juego corto" },
  { icon: Briefcase, label: "Renovar mi bolsa" },
  { icon: Sparkles, label: "Primer equipo" },
  { icon: Gift, label: "Encontrar un regalo" },
  { icon: RefreshCw, label: "Vender mi equipo" },
];

const proShopCategories = [
  "Palos",
  "Pelotas",
  "Ropa",
  "Calzado",
  "Bolsas",
  "Accesorios",
  "Seminuevos",
];

export default async function Home() {
  const productResult = await listPublicProducts();
  const selectedProducts = productResult.error
    ? []
    : productResult.data.slice(0, 4);

  return (
    <div className="bg-background text-foreground min-h-screen">
      <PublicHeader />

      <main>
        <section className="relative overflow-hidden border-b">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:min-h-[42rem] sm:px-6 sm:py-20 lg:min-h-[46rem] lg:grid-cols-[0.95fr_1.05fr] lg:gap-20 lg:px-8 lg:py-24">
            <div className="relative z-10 max-w-3xl">
              <p className="text-pg-charcoal before:bg-pg-gold flex items-center gap-3 text-xs font-semibold tracking-[0.2em] uppercase before:h-px before:w-8 sm:text-sm">
                Digital Pro Shop · México
              </p>
              <h1 className="font-heading mt-6 max-w-3xl text-[clamp(3.25rem,7vw,6.35rem)] leading-[0.94] font-bold tracking-[-0.045em] text-balance">
                El equipo correcto cambia tu juego.
              </h1>
              <p className="text-muted-foreground mt-7 max-w-2xl text-base leading-8 sm:text-lg">
                Equipo nuevo y seminuevo, seleccionado con criterio y acompañado
                por asesoría profesional para ayudarte a comprar con confianza.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/productos">
                    Explorar el Pro Shop
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-pg-gold/35 hover:border-pg-gold"
                >
                  <Link href="/cuenta">Entrar a Mi Golf</Link>
                </Button>
              </div>
              <div className="text-pg-charcoal mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold tracking-wide uppercase">
                <span>Equipo nuevo</span>
                <span className="text-pg-gold" aria-hidden="true">
                  •
                </span>
                <span>Seminuevos</span>
                <span className="text-pg-gold" aria-hidden="true">
                  •
                </span>
                <span>Asesoría profesional</span>
              </div>
            </div>

            <div className="bg-pg-warm-white relative mx-auto aspect-[4/3] w-full max-w-2xl overflow-hidden rounded-[20px] sm:aspect-[16/10] lg:aspect-[5/6] lg:max-w-xl">
              <Image
                src="/images/home/hero-golf-temporary.jpg"
                alt="Golfista terminando un golpe con driver frente a un campo de golf"
                fill
                preload
                sizes="(max-width: 1023px) calc(100vw - 2rem), 36rem"
                className="object-cover object-[center_62%]"
              />
              <div className="absolute right-5 bottom-5 left-5 rounded-xl bg-black/65 px-4 py-3 text-xs font-semibold tracking-[0.14em] text-white uppercase backdrop-blur-sm sm:right-auto sm:left-6">
                Selección con criterio · México
              </div>
            </div>
          </div>
        </section>

        <section
          className="bg-pg-black-soft text-white"
          aria-labelledby="improvement-heading"
        >
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-end lg:gap-16">
              <div>
                <p className="text-pg-gold text-xs font-semibold tracking-[0.2em] uppercase">
                  Empecemos por tu juego
                </p>
                <h2
                  id="improvement-heading"
                  className="font-heading mt-4 text-4xl leading-[1.05] font-bold tracking-[-0.035em] text-balance sm:text-5xl"
                >
                  ¿Qué quieres mejorar?
                </h2>
                <p className="mt-5 max-w-lg text-sm leading-7 text-white/65 sm:text-base">
                  Cada golfista llega con una necesidad distinta. Identificarla
                  es el primer paso para elegir mejor.
                </p>
              </div>

              <ul className="grid grid-cols-2 border-t border-l border-white/15 sm:grid-cols-3 lg:grid-cols-4">
                {improvementGoals.map(({ icon: Icon, label }) => (
                  <li
                    key={label}
                    className="group min-h-28 border-r border-b border-white/15 p-4 sm:min-h-32 sm:p-5"
                  >
                    <Icon
                      aria-hidden="true"
                      className="text-pg-gold size-5 stroke-[1.5]"
                    />
                    <span className="mt-7 block text-sm leading-5 font-semibold">
                      {label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
          <div className="max-w-2xl">
            <p className="before:bg-pg-gold flex items-center gap-3 text-xs font-semibold tracking-[0.2em] uppercase before:h-px before:w-8">
              Compra a tu manera
            </p>
            <h2 className="mt-4 text-3xl leading-tight font-semibold tracking-[-0.03em] text-balance sm:text-4xl">
              Tres formas de encontrar lo que tu juego necesita.
            </h2>
          </div>

          <ol className="mt-12 grid border-t lg:grid-cols-3">
            {shoppingPaths.map((path) => (
              <li
                key={path.number}
                className="border-b py-8 lg:border-r lg:px-8 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-pg-gold text-sm font-semibold">
                    {path.number}
                  </span>
                  {path.status ? (
                    <span className="bg-pg-warm-white text-pg-charcoal rounded-lg px-2.5 py-1 text-[0.68rem] font-semibold tracking-wide uppercase">
                      {path.status}
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-8 text-xl font-semibold">{path.title}</h3>
                <p className="text-muted-foreground mt-3 max-w-sm text-sm leading-7">
                  {path.description}
                </p>
                {path.href ? (
                  <Link
                    href={path.href}
                    className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                  >
                    Ver selección{" "}
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                ) : null}
              </li>
            ))}
          </ol>
        </section>

        <section className="bg-pg-warm-white">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-20">
              <div>
                <p className="before:bg-pg-gold flex items-center gap-3 text-xs font-semibold tracking-[0.2em] uppercase before:h-px before:w-8">
                  Una selección con intención
                </p>
                <h2 className="font-heading mt-5 text-4xl leading-[1.05] font-bold tracking-[-0.035em] text-balance sm:text-5xl">
                  Menos ruido. Mejores decisiones.
                </h2>
              </div>
              <div>
                <p className="text-pg-charcoal text-base leading-8 sm:text-lg">
                  Reunimos equipo nuevo y seminuevo para distintos momentos del
                  juego. Cada opción debe explicar con claridad qué es, en qué
                  condición está y cuándo puede llegar a tus manos.
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="mt-7 bg-transparent"
                >
                  <Link href="/productos">
                    Conocer la selección
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </div>

            <Link
              href="/productos"
              aria-label="Explorar equipo, ropa, calzado y accesorios en el Pro Shop"
              className="group mt-12 block rounded-[20px] focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none sm:mt-16"
            >
              <div className="bg-pg-white relative aspect-[4/3] overflow-hidden rounded-[20px] sm:aspect-[16/8] lg:aspect-[16/7]">
                <Image
                  src="/images/home/pro-shop-equipment-temporary.jpg"
                  alt="Bolsa con palos de golf, polo, zapatos, guante y pelotas"
                  fill
                  sizes="(max-width: 1279px) calc(100vw - 3rem), 80rem"
                  className="object-cover object-center transition-transform duration-200 group-hover:scale-[1.01]"
                />
              </div>
            </Link>

            <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
                  Explora el Pro Shop
                </p>
                <h3 className="font-heading mt-3 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
                  Todo lo que acompaña tu juego.
                </h3>
              </div>
              <Button asChild variant="outline" className="bg-transparent">
                <Link href="/productos">
                  Ver todo el equipo
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </div>

            <ul className="mt-8 grid grid-cols-2 border-t border-l sm:grid-cols-4 lg:grid-cols-7">
              {proShopCategories.map((category, index) => (
                <li
                  key={category}
                  className="bg-pg-white flex min-h-24 flex-col justify-between border-r border-b p-4 sm:min-h-28"
                >
                  <span className="text-pg-gold text-xs font-semibold">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm font-semibold">{category}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {selectedProducts.length > 0 ? (
          <section
            className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28"
            aria-labelledby="selected-products-heading"
          >
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <p className="before:bg-pg-gold flex items-center gap-3 text-xs font-semibold tracking-[0.2em] uppercase before:h-px before:w-8">
                  Disponible en el Pro Shop
                </p>
                <h2
                  id="selected-products-heading"
                  className="font-heading mt-4 text-4xl leading-[1.05] font-bold tracking-[-0.035em] sm:text-5xl"
                >
                  Equipo seleccionado.
                </h2>
                <p className="text-muted-foreground mt-5 max-w-xl text-base leading-7">
                  Producto real del catálogo, presentado con condición,
                  disponibilidad y precio claros.
                </p>
              </div>
              <Link
                href="/productos"
                className="hover:text-pg-gold inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                Ver todo el Pro Shop
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>

            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {selectedProducts.map((product, index) => (
                <li
                  key={product.id}
                  className={index > 1 ? "hidden sm:block" : undefined}
                >
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-24 lg:px-8 lg:py-32">
          <div className="bg-pg-black relative aspect-square max-w-lg overflow-hidden rounded-[20px] text-white">
            <Image
              src="/images/home/seminuevos-equipment-temporary.jpg"
              alt="Detalle cuidado de driver, hierros y putter seminuevos"
              fill
              sizes="(max-width: 1023px) calc(100vw - 2rem), 32rem"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-linear-to-b from-black/35 via-transparent to-black/65" />
            <div className="absolute top-8 left-8 text-xs font-semibold tracking-[0.18em] text-white/55 uppercase">
              Seminuevos / Peter Golf
            </div>
            <div className="absolute right-8 bottom-8 left-8 border-t border-white/15 pt-6">
              <div className="flex items-center gap-3 text-sm text-white/75">
                <Check aria-hidden="true" className="text-pg-gold size-4" />
                Condición explicada con claridad
              </div>
            </div>
          </div>

          <div className="max-w-xl">
            <p className="before:bg-pg-gold flex items-center gap-3 text-xs font-semibold tracking-[0.2em] uppercase before:h-px before:w-8">
              Una segunda vida, el mismo criterio
            </p>
            <h2 className="font-heading mt-5 text-4xl leading-[1.05] font-bold tracking-[-0.035em] text-balance sm:text-5xl">
              Seminuevos que puedes comprar con confianza.
            </h2>
            <p className="text-muted-foreground mt-6 text-base leading-8 sm:text-lg">
              Cada unidad se presenta con condición transparente, fotografías
              reales y la información que necesitas para decidir.
            </p>
            <Button asChild variant="outline" className="mt-8">
              <Link href="/productos">Ver el Pro Shop</Link>
            </Button>
          </div>
        </section>

        <section className="bg-pg-black-soft text-white">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16 lg:px-8 lg:py-28">
            <div className="max-w-2xl">
              <p className="text-pg-gold text-xs font-semibold tracking-[0.2em] uppercase">
                Asesoría Peter Golf
              </p>
              <h2 className="font-heading mt-5 text-4xl leading-[1.05] font-bold tracking-[-0.035em] text-balance sm:text-5xl">
                No tienes que saber exactamente qué comprar.
              </h2>
              <p className="mt-7 text-base leading-8 text-white/70">
                Cuéntanos qué estás jugando, qué quieres mejorar y cuál es tu
                presupuesto. Nuestro objetivo es ayudarte a comparar opciones y
                elegir con más claridad.
              </p>
              <p className="mt-6 text-xs font-semibold tracking-[0.16em] text-white/45 uppercase">
                Experiencia digital de asesoría en preparación
              </p>
            </div>

            <div className="bg-pg-charcoal relative aspect-[4/3] overflow-hidden rounded-[20px] sm:aspect-[16/10] lg:aspect-[3/2]">
              <Image
                src="/images/home/advice-fitting-temporary.jpg"
                alt="Golfista revisando un hierro junto a un especialista de golf"
                fill
                sizes="(max-width: 1023px) calc(100vw - 2rem), 44rem"
                className="object-cover object-center"
              />
            </div>
          </div>
        </section>

        <section aria-labelledby="trust-heading" className="border-b">
          <h2 id="trust-heading" className="sr-only">
            Razones para confiar en Peter Golf
          </h2>
          <ul className="mx-auto grid max-w-7xl divide-y px-4 sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:px-6 lg:grid-cols-4 lg:px-8">
            {trustPoints.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex min-h-28 items-center gap-4 py-6 sm:px-6 sm:first:pl-0 lg:min-h-32"
              >
                <Icon
                  aria-hidden="true"
                  className="text-pg-gold size-5 shrink-0 stroke-[1.5]"
                />
                <span className="text-sm font-semibold">{label}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 sm:py-32 lg:px-8">
          <p className="before:bg-pg-gold after:bg-pg-gold flex items-center justify-center gap-3 text-xs font-semibold tracking-[0.2em] uppercase before:h-px before:w-8 after:h-px after:w-8">
            Tu próxima decisión
          </p>
          <h2 className="font-heading mt-5 text-4xl leading-[1.05] font-bold tracking-[-0.04em] text-balance sm:text-6xl">
            No necesitas elegir solo.
          </h2>
          <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-base leading-8 sm:text-lg">
            Explora opciones seleccionadas con criterio. La experiencia de
            asesoría personalizada se integrará sin comprometer la claridad del
            proceso.
          </p>
          <Button asChild size="lg" className="mt-9">
            <Link href="/productos">
              Explorar el Pro Shop
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
