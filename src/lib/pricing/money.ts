const MAX_MINOR_UNITS = 99_999_999_999_999;

export function assertMinorUnits(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_MINOR_UNITS) {
    throw new Error(`${label} debe ser un importe válido en centavos.`);
  }
}

export function assertBasisPoints(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value >= 10_000) {
    throw new Error(`${label} debe expresarse en puntos base válidos.`);
  }
}

export function ceilDivide(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= BigInt(0) || numerator < BigInt(0)) {
    throw new Error("La división monetaria recibió valores inválidos.");
  }
  return (numerator + denominator - BigInt(1)) / denominator;
}

export function toSafeMinorUnits(value: bigint, label: string): number {
  const result = Number(value);
  assertMinorUnits(result, label);
  return result;
}

export function multiplyBpsCeil(amount: number, basisPoints: number): number {
  assertMinorUnits(amount, "Importe");
  assertBasisPoints(basisPoints, "Tasa");
  return toSafeMinorUnits(
    ceilDivide(BigInt(amount) * BigInt(basisPoints), BigInt(10_000)),
    "Resultado",
  );
}

export function ratioToBps(numerator: number, denominator: number): number {
  if (!Number.isSafeInteger(numerator)) {
    throw new Error("El numerador debe ser un entero seguro.");
  }
  assertMinorUnits(denominator, "Denominador");
  if (denominator === 0) return 0;
  return Number((BigInt(numerator) * BigInt(10_000)) / BigInt(denominator));
}
