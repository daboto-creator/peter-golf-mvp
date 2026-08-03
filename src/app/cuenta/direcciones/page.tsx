import type { Metadata } from "next";
import Link from "next/link";

import { AddressControls } from "@/components/customer/address-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuthenticatedUser } from "@/lib/auth/user";
import { getCustomerAddresses } from "@/lib/customer/customer-data";

export const metadata: Metadata = { title: "Mis direcciones | Peter Golf" };

export default async function AddressesPage() {
  await requireAuthenticatedUser("/cuenta/direcciones");
  const addresses = await getCustomerAddresses();
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Mis direcciones
          </h1>
          <p className="text-muted-foreground mt-2">
            Administra las direcciones que puedes usar en checkout.
          </p>
        </div>
        <Button asChild>
          <Link href="/cuenta/direcciones/nueva">Agregar dirección</Link>
        </Button>
      </div>
      {addresses === null ? (
        <Alert variant="destructive">
          <AlertDescription>
            No pudimos cargar tus direcciones.
          </AlertDescription>
        </Alert>
      ) : addresses.length === 0 ? (
        <Card>
          <CardContent className="space-y-4 py-10 text-center">
            <p className="text-muted-foreground">
              Todavía no tienes direcciones guardadas.
            </p>
            <Button asChild>
              <Link href="/cuenta/direcciones/nueva">
                Guardar mi primera dirección
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {addresses.map((address) => (
            <Card key={address.id}>
              <CardHeader className="flex-row items-center justify-between gap-3">
                <CardTitle>{address.label}</CardTitle>
                {address.isDefault ? (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-900">
                    Predeterminada
                  </span>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-4">
                <address className="text-muted-foreground text-sm leading-6 not-italic">
                  <strong className="text-foreground">
                    {address.recipientName}
                  </strong>
                  <br />
                  {address.street} {address.exteriorNumber}
                  {address.interiorNumber
                    ? `, Int. ${address.interiorNumber}`
                    : ""}
                  <br />
                  {address.neighborhood}, {address.city}, {address.state}, C.P.{" "}
                  {address.postalCode}
                  <br />
                  México · {address.phone}
                </address>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline">
                    <Link href={`/cuenta/direcciones/${address.id}/editar`}>
                      Editar
                    </Link>
                  </Button>
                </div>
                <AddressControls
                  id={address.id}
                  version={address.version}
                  isDefault={address.isDefault}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Button asChild variant="ghost">
        <Link href="/cuenta">Volver a mi cuenta</Link>
      </Button>
    </div>
  );
}
