import { NextResponse } from "next/server";
import { serverEnv } from "@/env/server";
import {
  calculateIntelligenceMetrics,
  calculateResaleSignal,
  calculateSourceReliability,
  type IntelligenceOutcome,
} from "@/lib/pricing/intelligence-learning";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (
    !serverEnv.NEXT_PUBLIC_SUPABASE_URL?.includes("xdulakstgsgdujjylhox") ||
    url.searchParams.get("synthetic") !== "1"
  )
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const outcomes: IntelligenceOutcome[] = Array.from(
    { length: 5 },
    (_, index) => ({
      id: `qa-${index}`,
      source: index % 2 ? "MARKETPLACE" : "FIRST_PARTY",
      brand: "Titleist",
      canonicalModel: "GT3",
      category: "Driver",
      condition: "used",
      acquisitionCostMinor: 400000,
      recommendedPriceMinor: 850000,
      finalSoldPriceMinor: 850000 + index * 10000,
      marketReferenceMinor: 850000,
      recommendationAccepted: index !== 4,
      listedAt: "2026-01-01T00:00:00Z",
      soldAt: "2026-01-25T00:00:00Z",
      daysInInventory: 20 + index,
      validEconomicSale: true,
    }),
  );
  const resale = calculateResaleSignal(outcomes, "Titleist", "GT3");
  const reliability = calculateSourceReliability(
    Array.from({ length: 5 }, (_, index) => ({
      source: "serpapi",
      accepted: index !== 4,
      similarity: 90,
      observedPriceMinor: 850000,
      actualSoldPriceMinor: 850000 + index * 10000,
      observedAt: "2026-01-01T00:00:00Z",
    })),
  );
  const metrics = calculateIntelligenceMetrics({
    outcomes,
    recommendationsPresented: 5,
    acceptedRecommendations: 4,
    analyses: [
      { resolvedWithoutExternal: true, cacheHit: true, usaFallback: false },
      { resolvedWithoutExternal: false, cacheHit: false, usaFallback: true },
    ],
    overrides: 1,
  });
  return NextResponse.json({ metrics, resale, reliability });
}
