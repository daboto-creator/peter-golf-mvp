"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  initialConversationState,
  type ConversationState,
} from "@/lib/best-round-pro/conversation";
import type { ConversationOutcomeResult } from "@/lib/best-round-pro/conversation";
import type { CommercialRankingResult } from "@/lib/recommendations/commercial-ranking";
import { formatMoneyMinorUnits } from "@/lib/catalog/presentation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const starts = [
  "Quiero un Driver",
  "Quiero mejorar mis hierros",
  "Necesito un Wedge",
  "Quiero cambiar mi Putter",
];
const roleLabels = {
  BEST_OPTION: "Mejor opción",
  BEST_VALUE: "Mejor valor",
  ALTERNATIVE: "Alternativa",
} as const;
const confidenceLabels = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
} as const;
const reasonLabels: Record<string, string> = {
  BEST_TECHNICAL_MATCH: "Es la opción que mejor encaja técnicamente contigo.",
  BEST_RESPONSIBLE_OPTION:
    "Es una opción responsable con los datos disponibles.",
  BEST_VALUE:
    "Ofrece un ahorro significativo manteniendo un ajuste responsable.",
  PREFERRED_BRAND: "Está dentro de las marcas que prefieres.",
  WITHIN_BUDGET: "Está dentro de tu presupuesto indicado.",
  USED_VALUE_OPTION: "Es una alternativa seminueva orientada a valor.",
  SLIGHTLY_ABOVE_BUDGET:
    "Está ligeramente por encima del presupuesto indicado.",
  LOWER_CONFIDENCE: "La confianza es limitada porque faltan algunos datos.",
  LIMITED_AVAILABILITY: "La disponibilidad es limitada.",
};

function customerPrice(amount: number) {
  return formatMoneyMinorUnits(amount).replace(/\.00$/, "");
}

export function BestRoundProChat({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<ConversationState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = window.sessionStorage.getItem("best-round-pro-session");
        if (saved) {
          const parsed = JSON.parse(saved) as ConversationState;
          if (parsed?.session && Array.isArray(parsed.messages)) return parsed;
        }
      } catch { /* optional storage */ }
    }
    return initialConversationState();
  });
  const [input, setInput] = useState("");
  const [reply, setReply] = useState(
    "Soy Best Round Pro. Te ayudo a encontrar equipo real que encaje con tu juego.",
  );
  const [recommendation, setRecommendation] = useState<CommercialRankingResult | null>(() => {
    if (typeof window !== "undefined") {
      try { return JSON.parse(window.sessionStorage.getItem("best-round-pro-recommendation") ?? "null") as CommercialRankingResult | null; } catch { /* optional storage */ }
    }
    return null;
  });
  const [outcome, setOutcome] = useState<ConversationOutcomeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    try {
      window.sessionStorage.setItem("best-round-pro-session", JSON.stringify(state));
    } catch {
      // Storage is optional.
    }
  }, [state]);
  const send = async (message = input) => {
    const text = message.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/best-round-pro", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, state }),
      });
      const payload = (await response.json()) as {
        state?: ConversationState;
        reply?: string;
        recommendation?: CommercialRankingResult | null;
        outcome?: ConversationOutcomeResult | null;
      };
      if (!response.ok || !payload.state) throw new Error("request");
      setState(payload.state);
      setReply(payload.reply ?? "");
      setRecommendation(payload.recommendation ?? null);
      try { window.sessionStorage.setItem("best-round-pro-recommendation", JSON.stringify(payload.recommendation ?? null)); } catch { /* optional storage */ }
      setOutcome(payload.outcome ?? null);
      setInput("");
    } catch {
      setError(
        "No pude completar la consulta. Tu mensaje se conservó; intenta nuevamente.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={embedded ? "grid gap-4" : "mx-auto grid max-w-5xl gap-8 lg:grid-cols-[0.82fr_1.18fr]"}>
      {!embedded ? <Card className="border-pg-black/10 bg-pg-black text-white">
        <CardHeader>
          <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
            Best Round Pro
          </p>
          <CardTitle className="font-heading text-3xl">
            Tu próximo equipo, con criterio de Pro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-white/75">
            Conversamos con lo que Mi Golf ya recuerda y validamos
            compatibilidad contra inventario real. Tú decides.
          </p>
          <div className="space-y-2">
            {starts.map((start) => (
              <Button
                key={start}
                variant="outline"
                className="w-full justify-start border-white/20 bg-white/5 text-white hover:bg-white/10"
                onClick={() => void send(start)}
              >
                {start}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            className="text-pg-black hover:text-pg-black focus-visible:text-pg-black w-full border-white/20 bg-white hover:bg-white/90"
            onClick={() => {
              setState(initialConversationState());
              setRecommendation(null);
              try { window.sessionStorage.removeItem("best-round-pro-recommendation"); } catch { /* optional storage */ }
              setOutcome(null);
              setReply("Empecemos de nuevo. ¿Qué equipo buscas?");
            }}
          >
            Nueva consulta
          </Button>
        </CardContent>
      </Card> : null}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl">
            Hablemos de tu juego
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="bg-muted/40 min-h-36 rounded-2xl p-5">
            <div className="space-y-3" aria-live="polite">
              {state.messages.length === 0 ? (
                <p className="leading-7">{reply}</p>
              ) : (
                state.messages.map((message, index) => (
                  <p
                    key={`${message.role}-${index}`}
                    className={
                      message.role === "assistant"
                        ? "leading-7"
                        : "text-muted-foreground text-sm"
                    }
                  >
                    {message.content}
                  </p>
                ))
              )}
              {busy ? (
                <p className="text-pg-gold font-semibold">Pensando…</p>
              ) : null}
            </div>
          </div>
          {error ? (
            <div
              role="alert"
              className="border-destructive/30 bg-destructive/10 text-destructive rounded-xl border p-3 text-sm"
            >
              {error}{" "}
              <button
                className="ml-2 font-semibold underline"
                onClick={() => void send()}
              >
                Reintentar
              </button>
            </div>
          ) : null}
          {recommendation?.status === "RECOMMENDATIONS" ? (
            <div className="grid gap-3">
              {recommendation.recommendations.map((item) => (
                <Card key={item.candidate.unitId} className="border-border/70">
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-muted-foreground text-xs uppercase">
                          {roleLabels[item.role]}
                        </p>
                        <h3 className="font-semibold">
                          {item.candidate.brand} {item.candidate.model}
                        </h3>
                      </div>
                      <span className="text-pg-gold font-semibold">
                        Match {item.equipmentMatch.matchScore}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      Confianza{" "}
                      {confidenceLabels[item.equipmentMatch.confidence]} ·{" "}
                      {item.candidate.condition === "new"
                        ? "Nuevo"
                        : item.candidate.condition === "used"
                          ? "Seminuevo"
                          : "Condición no indicada"}{" "}
                      ·{" "}
                      {item.candidate.priceMxnMinor !== null
                        ? `${customerPrice(item.candidate.priceMxnMinor)} MXN`
                        : "precio por confirmar"}
                    </p>
                    <p className="text-sm">
                      {item.safeReasons
                        .map((reason) => reasonLabels[reason] ?? "")
                        .filter(Boolean)
                        .join(" ")}
                    </p>
                    {item.candidate.productHref ? <Link
                      className="text-pg-gold text-sm font-semibold"
                      href={item.candidate.productHref}
                      onClick={(event) => {
                        event.preventDefault();
                        window.dispatchEvent(new CustomEvent("best-round-pro:close"));
                        router.push(item.candidate.productHref!);
                      }}
                    >
                      Ver producto
                    </Link> : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}
          {recommendation?.status !== "RECOMMENDATIONS" && outcome ? (
            <div role="status" className="rounded-xl border border-pg-gold/30 bg-pg-gold/10 p-4 text-sm leading-6">
              {outcome.message}
            </div>
          ) : null}
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void send();
              }}
              placeholder="Cuéntame qué buscas…"
              className="border-input bg-background min-h-11 flex-1 rounded-xl border px-4 text-sm"
              disabled={busy}
            />
            <Button
              onClick={() => void send()}
              disabled={busy || !input.trim()}
            >
              {busy ? "Pensando…" : "Enviar"}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Compatibilidad estimada con la información disponible; no sustituye
            una sesión de fitting profesional.
          </p>
          <Button asChild variant="link" className="px-0">
            <a
              href="https://wa.me/?text=Quiero%20consultar%20con%20un%20Pro%20de%20Best%20Round"
              target="_blank"
              rel="noreferrer"
            >
              Consultar con un Pro
            </a>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
