import { NextResponse } from "next/server";

import { PARTNER_KYC_BUCKET } from "@/lib/marketplace/partner-rules";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const { id, documentId } = await params;
  const client = await createClient();
  const [
    {
      data: { user },
    },
    capability,
  ] = await Promise.all([
    client.auth.getUser(),
    client.rpc("can_review_partner_documents"),
  ]);
  if (!user)
    return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  if (capability.data !== true)
    return NextResponse.json({ error: "No disponible" }, { status: 404 });
  const document = await client
    .from("partner_documents")
    .select("storage_path")
    .eq("id", documentId)
    .eq("partner_id", id)
    .maybeSingle();
  if (!document.data)
    return NextResponse.json({ error: "No disponible" }, { status: 404 });
  const signed = await client.storage
    .from(PARTNER_KYC_BUCKET)
    .createSignedUrl(document.data.storage_path, 60);
  if (!signed.data || signed.error)
    return NextResponse.json(
      { error: "No pudimos abrir el documento" },
      { status: 500 },
    );
  return NextResponse.redirect(signed.data.signedUrl);
}
