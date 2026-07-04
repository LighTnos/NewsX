"use client";

import { useEffect, useRef, useState } from "react";

// Awwwards-style cursor: a precise dot that tracks instantly plus a ring
// that lerps behind it and expands over interactive elements. Renders
// nothing on touch devices; native cursor is suppressed via a root class.
export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    setEnabled(true);
    document.documentElement.classList.add("custom-cursor");
    return () => document.documentElement.classList.remove("custom-cursor");
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let ringX = x;
    let ringY = y;
    const instant = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      dot.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    };

    const onOver = (e: PointerEvent) => {
      const interactive = (e.target as Element).closest?.(
        "a, button, [role='button'], input, select, [data-cursor]"
      );
      ring.style.width = ring.style.height = interactive ? "44px" : "28px";
      ring.style.borderColor = interactive
        ? "var(--accent)"
        : "rgba(255, 255, 255, 0.35)";
    };

    let raf = 0;
    const loop = () => {
      const ease = instant ? 1 : 0.16;
      ringX += (x - ringX) * ease;
      ringY += (y - ringY) * ease;
      ring.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`;
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerover", onOver);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerover", onOver);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[999]">
      <div
        ref={ringRef}
        className="fixed top-0 left-0 h-7 w-7 rounded-full border transition-[width,height,border-color] duration-300"
        style={{ borderColor: "rgba(255,255,255,0.35)" }}
      />
      <div
        ref={dotRef}
        className="fixed top-0 left-0 h-1.5 w-1.5 rounded-full bg-foreground"
      />
    </div>
  );
}
