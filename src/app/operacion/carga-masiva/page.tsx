import type { Metadata } from "next";
import { BulkImportForm } from "@/components/operations/bulk-import-form";
import { listBulkImportPartners } from "@/lib/bulk-import/service";

export const metadata: Metadata = { title: "Carga masiva | Best Round Pro Shop" };

export default async function BulkImportPage() {
  const partners = await listBulkImportPartners();
  return <div className="space-y-8"><div><p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">Operaciones</p><h1 className="text-pg-black mt-3 text-4xl font-semibold">Carga masiva</h1><p className="text-muted-foreground mt-3 max-w-2xl">Carga inventario Best Round o publicaciones Partner, normaliza referencias y revisa precios sin crear todavía registros de dominio.</p></div><BulkImportForm partners={partners} /></div>;
}
