import { z } from "zod";

import { downloadPublicMarketplaceImage } from "@/lib/marketplace/public-image-data";

export const dynamic = "force-dynamic";

const identifiers = z.object({
  listingId: z.uuid(),
  imageId: z.uuid(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ listingId: string; imageId: string }> },
) {
  const parsed = identifiers.safeParse(await context.params);
  if (!parsed.success) return new Response(null, { status: 404 });
  try {
    const image = await downloadPublicMarketplaceImage(
      parsed.data.listingId,
      parsed.data.imageId,
    );
    if (!image) return new Response(null, { status: 404 });
    return new Response(await image.blob.arrayBuffer(), {
      headers: {
        "Content-Type": image.mimeType,
        "Cache-Control": "private, max-age=60, must-revalidate",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    console.error(JSON.stringify({ event: "marketplace_public_image_failed" }));
    return new Response(null, { status: 404 });
  }
}
