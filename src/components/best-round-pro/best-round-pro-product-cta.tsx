"use client";

export function BestRoundProProductCta({ productId, slug, name, productFamily }: { productId: string; slug: string; name: string; productFamily: string | null }) {
  return (
    <button
      type="button"
      data-best-round-pro-exclusion
      className="border-border text-pg-black hover:bg-muted mt-3 flex min-h-11 w-full items-center justify-center rounded-xl border px-4 text-sm font-semibold transition-colors"
      onClick={() => {
        window.sessionStorage.setItem("best-round-pro-current-product", JSON.stringify({ id: productId, slug, name, productFamily }));
        window.dispatchEvent(new CustomEvent("best-round-pro:open", { detail: { source: "PRODUCT", productId } }));
      }}
    >
      ¿Es bueno para mí?
    </button>
  );
}
