import type { Metadata } from "next";
import Link from "next/link";

import { AddressForm } from "@/components/customer/address-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAuthenticatedUser } from "@/lib/auth/user";

export const metadata: Metadata = { title: "Nueva dirección | Peter Golf" };

export default async function NewAddressPage() {
  await requireAuthenticatedUser("/cuenta/direcciones/nueva");
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost">
        <Link href="/cuenta/direcciones">Volver a direcciones</Link>
      </Button>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Nueva dirección</CardTitle>
          <CardDescription>El país está fijo en México.</CardDescription>
        </CardHeader>
        <CardContent>
          <AddressForm />
        </CardContent>
      </Card>
    </div>
  );
}
