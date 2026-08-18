import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { AddressForm } from "@/components/customer/address-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuthenticatedUser } from "@/lib/auth/user";
import { getCustomerAddress } from "@/lib/customer/customer-data";

export const metadata: Metadata = { title: "Editar dirección | Peter Golf" };

export default async function EditAddressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuthenticatedUser("/cuenta/direcciones");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const address = await getCustomerAddress(id);
  if (!address) notFound();
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost">
        <Link href="/cuenta/direcciones">Volver a direcciones</Link>
      </Button>
      <Card className="max-w-3xl rounded-[20px]">
        <CardHeader>
          <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
            Mi Golf
          </p>
          <CardTitle className="font-heading text-3xl font-bold">
            Editar dirección
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AddressForm address={address} />
        </CardContent>
      </Card>
    </div>
  );
}
