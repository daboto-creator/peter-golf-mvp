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

export const metadata: Metadata = {
  title: "Operación | Peter Golf",
};

export default function OperationsPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium tracking-wide text-emerald-800 uppercase">
          Área protegida
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Operación
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl leading-7">
          Administra la información comercial base del catálogo. Los cambios
          requieren una sesión con permiso de operador o administrador.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Notificaciones</CardTitle>
            <CardDescription>
              Procesa y supervisa correos transaccionales locales sin afectar
              pedidos ni pagos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg">
              <Link href="/operacion/notificaciones">Abrir notificaciones</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pedidos manuales</CardTitle>
            <CardDescription>
              Registra ventas asistidas, confirma existencias y conserva su
              historial operativo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg">
              <Link href="/operacion/pedidos">Administrar pedidos</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Gestión de catálogo</CardTitle>
            <CardDescription>
              Crea, edita, publica, despublica, archiva y restaura productos
              base.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg">
              <Link href="/operacion/catalogo">Abrir catálogo operativo</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Inventario</CardTitle>
            <CardDescription>
              Consulta saldos y registra incrementos o correcciones con un
              historial inmutable.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg" variant="outline">
              <Link href="/operacion/inventario">Administrar inventario</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Marcas y categorías</CardTitle>
            <CardDescription>
              Administra las referencias disponibles para clasificar productos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg" variant="outline">
              <Link href="/operacion/taxonomias">Administrar taxonomías</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
