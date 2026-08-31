import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { getIdentityVerificationProvider } from "@/lib/identity-verification/provider";
import { processPartnerIdentityWebhook } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const provider = getIdentityVerificationProvider();
  if (!provider || provider.name !== "DIDIT") {
    return NextResponse.json(
      { received: false, code: "disabled" },
      { status: 503 },
    );
  }
  const rawBody = await request.text();
  try {
    const normalized = provider.verifyAndNormalizeWebhook({
      rawBody,
      headers: request.headers,
    });
    const processed = await processPartnerIdentityWebhook({
      provider: provider.name,
      ...normalized,
      payloadSha256: createHash("sha256").update(rawBody).digest("hex"),
    });
    return NextResponse.json({ received: true, replayed: !processed });
  } catch {
    console.error("identity_webhook", {
      provider: provider.name,
      code: "rejected",
    });
    return NextResponse.json(
      { received: false, code: "rejected" },
      { status: 400 },
    );
  }
}
