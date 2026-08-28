"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { initialPartnerActionState } from "@/lib/marketplace/partner-action-state";
import { setMarketplaceEnabledAction } from "@/lib/marketplace/publication-actions";

export function MarketplaceActivationForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState(
    setMarketplaceEnabledAction,
    initialPartnerActionState,
  );
  const nextEnabled = !enabled;
  return (
    <form action={action} className="space-y-4 rounded-xl border bg-white p-5">
      <input type="hidden" name="enabled" value={String(nextEnabled)} />
      <input type="hidden" name="expectedEnabled" value={String(enabled)} />
      <label className="block text-sm font-medium">
        Razón operativa
        <textarea
          name="reason"
          minLength={3}
          maxLength={500}
          required
          className="border-input mt-2 min-h-24 w-full rounded-xl border p-3"
        />
      </label>
      <label className="flex items-start gap-3 text-sm leading-6">
        <input name="confirmed" type="checkbox" required className="mt-1" />
        <span>
          {nextEnabled
            ? "Al activar Marketplace, los listings elegibles podrán aparecer en el catálogo y ser comprados."
            : "Al desactivar Marketplace se ocultarán los listings y se bloquearán compras nuevas; las órdenes pagadas continuarán."}
        </span>
      </label>
      <Button
        type="submit"
        disabled={pending}
        variant={nextEnabled ? "default" : "destructive"}
      >
        {pending
          ? "Procesando…"
          : nextEnabled
            ? "Enable Marketplace"
            : "Disable Marketplace"}
      </Button>
      {state.message ? (
        <p
          role="status"
          className={
            state.status === "success"
              ? "text-sm text-emerald-700"
              : "text-destructive text-sm"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
