import Image from "next/image";
import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { BRAND_NAME } from "@/lib/brand";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="bg-pg-warm-white min-h-screen p-3 sm:p-6 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] w-full max-w-6xl overflow-hidden rounded-[20px] border bg-white sm:min-h-[calc(100vh-3rem)] lg:grid-cols-[0.92fr_1.08fr]">
        <section className="flex flex-col px-6 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-12">
          <Link
            href="/"
            aria-label={`${BRAND_NAME}, inicio`}
            className="focus-visible:ring-pg-gold w-fit rounded-xl focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none"
          >
            <BrandLogo background="light" preload className="w-28 sm:w-32" />
          </Link>

          <div className="my-auto py-10 lg:py-14">
            <p className="before:bg-pg-gold flex items-center gap-3 text-xs font-semibold tracking-[0.18em] uppercase before:h-px before:w-8">
              Mi Golf
            </p>
            <h1 className="font-heading text-pg-black mt-4 text-4xl leading-tight font-bold tracking-[-0.035em] sm:text-5xl">
              {title}
            </h1>
            <p className="text-muted-foreground mt-4 max-w-md leading-7">
              {description}
            </p>
            <div className="mt-8 max-w-md">{children}</div>
          </div>

          <p className="text-muted-foreground text-xs">
            Compra con claridad · Asesoría cuando la necesites
          </p>
        </section>

        <figure className="relative hidden min-h-[42rem] overflow-hidden lg:block">
          <Image
            src="/images/home/hero-golf-temporary.jpg"
            alt="Golfista jugando frente a un campo de golf"
            fill
            sizes="(min-width: 1024px) 52vw"
            loading="eager"
            className="object-cover object-[center_62%]"
          />
          <figcaption className="absolute right-8 bottom-8 left-8 rounded-xl bg-black/65 p-6 text-white backdrop-blur-sm">
            <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
              {BRAND_NAME}
            </p>
            <p className="font-heading mt-3 max-w-lg text-3xl leading-tight font-bold">
              Tu equipo, tus pedidos y tu juego en un solo lugar.
            </p>
            <p className="mt-3 text-xs tracking-[0.12em] text-white/70 uppercase">
              Imagen editorial
            </p>
          </figcaption>
        </figure>
      </div>
    </main>
  );
}
