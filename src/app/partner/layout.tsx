import {
  BriefcaseBusiness,
  FileCheck2,
  LayoutDashboard,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { ModeSwitcher } from "@/components/marketplace/mode-switcher";
import { Button } from "@/components/ui/button";
import { requireMarketplaceUser } from "@/lib/auth/marketplace-authorization";
import { getCurrentPartnerContext } from "@/lib/marketplace/partner-data";

export const dynamic = "force-dynamic";

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireMarketplaceUser("/partner");
  const { partner } = await getCurrentPartnerContext();
  return (
    <div className="bg-pg-warm-white min-h-screen">
      <header className="bg-pg-black border-pg-gold/30 border-b text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/partner" className="flex items-center gap-3 rounded-lg">
            <BrandLogo background="dark" className="w-16" />
            <span>
              <span className="block text-xs tracking-[0.14em] text-white/55 uppercase">
                Best Round
              </span>
              <span className="block text-sm font-semibold">
                Portal Partner
              </span>
            </span>
          </Link>
          <ModeSwitcher mode="partner" hasPartner={Boolean(partner)} />
        </div>
      </header>
      {partner ? (
        <div className="border-border border-b bg-white">
          <nav
            aria-label="Portal Partner"
            className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8"
          >
            <Button asChild variant="ghost" className="shrink-0">
              <Link href="/partner">
                <LayoutDashboard aria-hidden="true" />
                Dashboard
              </Link>
            </Button>
            <Button asChild variant="ghost" className="shrink-0">
              <Link href="/partner/perfil">
                <UserRound aria-hidden="true" />
                Perfil
              </Link>
            </Button>
            <Button asChild variant="ghost" className="shrink-0">
              <Link href="/partner/verificacion">
                <FileCheck2 aria-hidden="true" />
                Verificación
              </Link>
            </Button>
            {["Publicaciones", "Ventas", "Liquidaciones", "Score", "Tier"].map(
              (label) => (
                <Button
                  key={label}
                  disabled
                  variant="ghost"
                  className="shrink-0"
                  title="Próximamente"
                >
                  <BriefcaseBusiness aria-hidden="true" />
                  {label}
                  <span className="sr-only"> (Próximamente)</span>
                </Button>
              ),
            )}
          </nav>
        </div>
      ) : null}
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        {children}
      </main>
    </div>
  );
}
