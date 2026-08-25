import type { Metadata } from "next";
import {
  Bell,
  ClipboardList,
  Images,
  PackageSearch,
  Tags,
  Warehouse,
  UsersRound,
} from "lucide-react";
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
  title: "Operación | Best Round Pro Shop",
};

export default function OperationsPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
          Best Round Pro Shop profesional
        </p>
        <h1 className="text-pg-black mt-3 text-4xl font-semibold tracking-[-0.035em]">
          Centro de operaciones
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl leading-7">
          Administra la información comercial base del catálogo. Los cambios
          requieren una sesión con permiso de operador o administrador.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Card className="rounded-[20px]">
          <CardHeader>
            <Images className="text-pg-gold size-5" aria-hidden="true" />
            <CardTitle>Publicaciones Partner</CardTitle>
            <CardDescription>
              Revisa identidad, fotos, condición, cantidad y versiones antes de
              aprobar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg">
              <Link href="/operacion/marketplace/publicaciones">
                Abrir cola de revisión
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="rounded-[20px]">
          <CardHeader>
            <UsersRound className="text-pg-gold size-5" aria-hidden="true" />
            <CardTitle>Best Round Partners</CardTitle>
            <CardDescription>
              Revisa perfiles, documentos privados y estados de verificación.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg">
              <Link href="/operacion/marketplace/partners">
                Revisar Partners
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="rounded-[20px]">
          <CardHeader>
            <Bell className="text-pg-gold size-5" aria-hidden="true" />
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
        <Card className="rounded-[20px]">
          <CardHeader>
            <ClipboardList className="text-pg-gold size-5" aria-hidden="true" />
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
        <Card className="rounded-[20px]">
          <CardHeader>
            <PackageSearch className="text-pg-gold size-5" aria-hidden="true" />
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
        <Card className="rounded-[20px]">
          <CardHeader>
            <Warehouse className="text-pg-gold size-5" aria-hidden="true" />
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
        <Card className="rounded-[20px]">
          <CardHeader>
            <Tags className="text-pg-gold size-5" aria-hidden="true" />
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
