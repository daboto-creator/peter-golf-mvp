"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { BestRoundProChat } from "./best-round-pro-chat";

const POSITION_KEY = "best-round-pro-agent-position";

export function BestRoundProAgentProvider() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const [position, setPosition] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = JSON.parse(window.sessionStorage.getItem(POSITION_KEY) ?? "null");
        if (saved?.edge === "left" || saved?.edge === "right") return { edge: saved.edge, top: Number(saved.top) || 78 };
      } catch { /* optional persistence */ }
    }
    return { edge: "right" as "left" | "right", top: 78 };
  });
  const [dragging, setDragging] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const closeShell = useCallback(() => {
    setOpen(false);
    window.setTimeout(() => launcherRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    const openFromContext = () => setOpen(true);
    const closeFromContext = closeShell;
    window.addEventListener("best-round-pro:open", openFromContext);
    window.addEventListener("best-round-pro:close", closeFromContext);
    return () => {
      window.removeEventListener("best-round-pro:open", openFromContext);
      window.removeEventListener("best-round-pro:close", closeFromContext);
    };
  }, [closeShell]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") closeShell(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeShell]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!window.sessionStorage.getItem("best-round-pro-agent-teaser-seen")) {
        setTeaser(true);
        window.sessionStorage.setItem("best-round-pro-agent-teaser-seen", "1");
      }
    }, 5000);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const clamp = () => setPosition((p) => ({ ...p, top: Math.min(88, Math.max(12, p.top)) }));
    window.addEventListener("resize", clamp);
    window.addEventListener("orientationchange", clamp);
    return () => { window.removeEventListener("resize", clamp); window.removeEventListener("orientationchange", clamp); };
  }, []);
  const savePosition = useCallback((next: typeof position) => {
    setPosition(next);
    try { window.sessionStorage.setItem(POSITION_KEY, JSON.stringify(next)); } catch { /* optional */ }
  }, []);
  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    moved.current = false;
    startX.current = event.clientX;
    startY.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const dx = event.clientX - startX.current;
    const dy = event.clientY - startY.current;
    if (Math.hypot(dx, dy) < 8) return;
    moved.current = true;
    setDragging(true);
    savePosition({ edge: event.clientX < window.innerWidth / 2 ? "left" : "right", top: Math.min(88, Math.max(12, (event.clientY / window.innerHeight) * 100)) });
  };
  const onPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    const collision = Array.from(document.querySelectorAll<HTMLElement>("[data-best-round-pro-exclusion]"))
      .map((element) => element.getBoundingClientRect())
      .find((zone) => rect.left < zone.right && rect.right > zone.left && rect.top < zone.bottom && rect.bottom > zone.top);
    if (collision) {
      const safeTop = Math.max(12, Math.min(88, ((collision.top - rect.height - 12) / window.innerHeight) * 100));
      savePosition({ edge: position.edge, top: safeTop });
    }
    setDragging(false);
  };
  if (/^\/operacion(?:\/|$)/.test(pathname) || /^\/partner(?:\/|$)/.test(pathname) || pathname === "/best-round-pro") return null;
  return (
    <>
      {teaser && !open ? <div className={`fixed z-50 ${position.edge === "right" ? "right-5" : "left-5"}`} style={{ top: `calc(${position.top}% - 58px)` }}>
        <div className="flex items-start gap-2 rounded-2xl border border-pg-gold/30 bg-white px-3 py-2 text-xs font-medium text-pg-black shadow-lg">
          <button type="button" aria-label="Cerrar sugerencia" className="order-2 text-sm leading-none text-pg-black/60" onClick={() => setTeaser(false)}>×</button>
          <button type="button" className="text-left" onClick={() => { setTeaser(false); setOpen(true); }}>¿Te ayudo a encontrar el equipo ideal?</button>
        </div>
      </div> : null}
      {!open ? <button
        ref={launcherRef}
        type="button"
        aria-label="Best Round Pro Agent"
        className="fixed z-50 size-16 touch-none rounded-full border-2 border-pg-gold bg-pg-black p-1 shadow-xl transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pg-gold"
        style={{ [position.edge]: "max(1rem, env(safe-area-inset-right))", top: `${position.top}%`, transform: "translateY(-50%)" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={() => { if (!moved.current) setOpen(true); }}
        data-dragging={dragging}
      ><Image src="/images/best-round-pro-agent.png" alt="" width={56} height={56} className="size-full rounded-full object-cover" priority /></button> : null}
      {open ? <div role="dialog" aria-modal="true" aria-labelledby="best-round-pro-shell-title" className="fixed inset-0 z-50 bg-black/20">
        <aside className="absolute right-0 top-0 h-full w-full max-w-[480px] overflow-y-auto bg-pg-warm-white shadow-2xl sm:w-[min(480px,100vw)]">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-pg-warm-white/95 px-5 py-4 backdrop-blur">
            <div><p id="best-round-pro-shell-title" className="font-heading text-xl">Best Round Pro</p><p className="text-muted-foreground text-xs">Tu asesor de golf</p></div>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Minimizar Best Round Pro Agent" className="inline-flex size-10 items-center justify-center rounded-lg text-lg font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-pg-gold" onClick={closeShell}>−</button>
              <button type="button" aria-label="Cerrar Best Round Pro Agent" className="inline-flex size-10 items-center justify-center rounded-lg text-xl font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-pg-gold" onClick={closeShell}>×</button>
            </div>
          </div>
          <div className="p-4"><BestRoundProChat embedded /></div>
        </aside>
      </div> : null}
    </>
  );
}
