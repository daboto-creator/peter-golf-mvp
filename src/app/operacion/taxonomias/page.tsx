import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Taxonomías | Best Round Pro Shop" };

export default function TaxonomiesPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
          Gestión de catálogo
        </p>
        <h1 className="text-pg-black mt-3 text-4xl font-semibold tracking-[-0.035em]">
          Marcas y categorías
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl leading-7">
          Administra las referencias del catálogo sin eliminar relaciones
          históricas.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Marcas</CardTitle>
            <CardDescription>
              Nombres comerciales y estado disponible para productos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/operacion/taxonomias/marcas">
                Administrar marcas
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Categorías</CardTitle>
            <CardDescription>
              Jerarquía, orden y clasificación operativa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/operacion/taxonomias/categorias">
                Administrar categorías
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
