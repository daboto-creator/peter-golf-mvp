"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { BestRoundProChat } from "./best-round-pro-chat";

const POSITION_KEY = "best-round-pro-agent-position";

export function BestRoundProAgentProvider() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
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
  const moved = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);

  useEffect(() => {
    const openFromContext = () => setOpen(true);
    window.addEventListener("best-round-pro:open", openFromContext);
    return () => window.removeEventListener("best-round-pro:open", openFromContext);
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
      {!open ? <button
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
            <button type="button" aria-label="Cerrar Best Round Pro" className="rounded-lg px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-pg-gold" onClick={() => setOpen(false)}>Cerrar</button>
          </div>
          <div className="p-4"><BestRoundProChat embedded /></div>
        </aside>
      </div> : null}
    </>
  );
}
