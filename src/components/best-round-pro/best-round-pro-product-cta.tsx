"use client";

export function BestRoundProProductCta({ productId }: { productId: string }) {
  return (
    <button
      type="button"
      data-best-round-pro-exclusion
      className="border-border text-pg-black hover:bg-muted mt-3 flex min-h-11 w-full items-center justify-center rounded-xl border px-4 text-sm font-semibold transition-colors"
      onClick={() => window.dispatchEvent(new CustomEvent("best-round-pro:open", { detail: { source: "PRODUCT", productId } }))}
    >
      ¿Es bueno para mí?
    </button>
  );
}
