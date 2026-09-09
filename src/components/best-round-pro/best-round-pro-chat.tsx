"use client";

import { useState } from "react";
import Link from "next/link";

import {
  initialConversationState,
  type ConversationState,
} from "@/lib/best-round-pro/conversation";
import type { CommercialRankingResult } from "@/lib/recommendations/commercial-ranking";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const starts = [
  "Quiero un Driver",
  "Quiero mejorar mis hierros",
  "Necesito un Wedge",
  "Quiero cambiar mi Putter",
];

export function BestRoundProChat() {
  const [state, setState] = useState<ConversationState>(
    initialConversationState(),
  );
  const [input, setInput] = useState("");
  const [reply, setReply] = useState(
    "Soy Best Round Pro. Te ayudo a encontrar equipo real que encaje con tu juego.",
  );
  const [recommendation, setRecommendation] =
    useState<CommercialRankingResult | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async (message = input) => {
    const text = message.trim();
    if (!text || busy) return;
    setBusy(true);
    setInput("");
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
      };
      if (!response.ok || !payload.state) throw new Error("request");
      setState(payload.state);
      setReply(payload.reply ?? "");
      setRecommendation(payload.recommendation ?? null);
    } catch {
      setReply("No pude completar la consulta. Intenta nuevamente.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[0.82fr_1.18fr]">
      <Card className="border-pg-black/10 bg-pg-black text-white">
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
            className="w-full border-white/20 text-white"
            onClick={() => {
              setState(initialConversationState());
              setRecommendation(null);
              setReply("Empecemos de nuevo. ¿Qué equipo buscas?");
            }}
          >
            Nueva consulta
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl">
            Hablemos de tu juego
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="bg-muted/40 min-h-36 rounded-2xl p-5">
            <p className="leading-7">{reply}</p>
            {state.session.unresolvedQuestions[0] ? (
              <p className="text-pg-gold mt-4 font-semibold">{reply}</p>
            ) : null}
          </div>
          {recommendation?.status === "RECOMMENDATIONS" ? (
            <div className="grid gap-3">
              {recommendation.recommendations.map((item) => (
                <Card key={item.candidate.unitId} className="border-border/70">
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-muted-foreground text-xs uppercase">
                          {item.role.replaceAll("_", " ")}
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
                      Confianza {item.equipmentMatch.confidence.toLowerCase()} ·{" "}
                      {item.candidate.condition ?? "condición no indicada"} ·{" "}
                      {item.candidate.priceMxnMinor !== null
                        ? `$${(item.candidate.priceMxnMinor / 100).toLocaleString("es-MX")}`
                        : "precio por confirmar"}
                    </p>
                    <p className="text-sm">{item.safeReasons.join(" · ")}</p>
                    <Link
                      className="text-pg-gold text-sm font-semibold"
                      href="/productos"
                    >
                      Ver inventario
                    </Link>
                  </CardContent>
                </Card>
              ))}
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
              {busy ? "…" : "Enviar"}
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
