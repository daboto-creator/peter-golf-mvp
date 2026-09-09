import type { Metadata } from "next";

import { PublicFooter } from "@/components/catalog/public-footer";
import { PublicHeader } from "@/components/catalog/public-header";
import { BestRoundProChat } from "@/components/best-round-pro/best-round-pro-chat";

export const metadata: Metadata = {
  title: "Best Round Pro | Tu asesor de golf",
};

export default function BestRoundProPage() {
  return (
    <div className="bg-pg-warm-white min-h-screen">
      <PublicHeader />
      <main className="px-4 py-10 sm:px-6 lg:px-8">
        <BestRoundProChat />
      </main>
      <PublicFooter />
    </div>
  );
}
