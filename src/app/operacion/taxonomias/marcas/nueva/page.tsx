import type { Metadata } from "next";
import Link from "next/link";

import { BrandForm } from "@/components/operations/taxonomy-forms";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Nueva marca | Best Round Pro Shop",
};

export default function NewBrandPage() {
  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="ghost" className="-ml-2">
          <Link href="/operacion/taxonomias/marcas">← Volver a marcas</Link>
        </Button>
        <h1 className="text-pg-black mt-4 text-4xl font-semibold tracking-[-0.035em]">
          Crear marca
        </h1>
        <p className="text-muted-foreground mt-3">
          El slug no cambiará automáticamente después de guardar.
        </p>
      </div>
      <BrandForm
        mode="create"
        defaultValues={{
          name: "",
          slug: "",
          description: "",
          status: "active",
        }}
      />
    </div>
  );
}
