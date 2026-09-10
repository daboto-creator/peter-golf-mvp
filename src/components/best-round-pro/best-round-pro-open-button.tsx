"use client";

export function BestRoundProOpenButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="bg-pg-black text-white hover:bg-pg-black/90 mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold"
      onClick={() => window.dispatchEvent(new CustomEvent("best-round-pro:open", { detail: { source: "MI_GOLF" } }))}
    >
      {children}
    </button>
  );
}
