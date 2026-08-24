import { assertMinorUnits } from "@/lib/pricing/money";

/**
 * Commercial endings are evaluated in every MXN 1,000 block. Repeating `99`
 * each hundred avoids disproportionate jumps for lower prices, while the
 * 490/499/890/899/990/999 endings cover the preferred Best Round anchors.
 */
const COMMERCIAL_OFFSETS_MXN = [
  99, 199, 299, 399, 490, 499, 599, 699, 799, 890, 899, 990, 999,
] as const;

function firstCommercialCandidate(minimumMinor: number): number {
  const minimumWholeMxn = Math.ceil(minimumMinor / 100);
  let block = Math.floor(minimumWholeMxn / 1_000) * 1_000;

  for (;;) {
    for (const offset of COMMERCIAL_OFFSETS_MXN) {
      const candidate = (block + offset) * 100;
      if (candidate >= minimumMinor) return candidate;
    }
    block += 1_000;
  }
}

export function roundUpToCommercialPrice(
  minimumMinor: number,
  marketUpperBoundMinor?: number | null,
): number {
  assertMinorUnits(minimumMinor, "Precio mínimo");
  if (marketUpperBoundMinor !== null && marketUpperBoundMinor !== undefined) {
    assertMinorUnits(marketUpperBoundMinor, "Límite superior de mercado");
  }

  const candidate = firstCommercialCandidate(minimumMinor);
  if (
    marketUpperBoundMinor !== null &&
    marketUpperBoundMinor !== undefined &&
    candidate > marketUpperBoundMinor &&
    minimumMinor <= marketUpperBoundMinor
  ) {
    // No existe una terminación comercial válida dentro del rango: conserva
    // el mínimo exacto para proteger finanzas sin exceder mercado.
    return minimumMinor;
  }
  return candidate;
}
