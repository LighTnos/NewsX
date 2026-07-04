"use client";

import { useEffect, useRef } from "react";

// Sparse static starfield drawn once per resize, with a gentle pointer
// parallax on the whole canvas. No per-frame drawing cost.
export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const count = Math.floor((w * h) / 6000);
      for (let i = 0; i < count; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const r = Math.random() * 0.9 + 0.3;
        const alpha = Math.random() * 0.55 + 0.15;
        // Occasional faint blue-white tint for depth.
        const blue = Math.random() > 0.85;
        ctx.fillStyle = blue
          ? `rgba(180, 200, 255, ${alpha})`
          : `rgba(230, 235, 245, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    draw();
    window.addEventListener("resize", draw);

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const onPointerMove = (e: PointerEvent) => {
      const dx = (e.clientX / window.innerWidth - 0.5) * -10;
      const dy = (e.clientY / window.innerHeight - 0.5) * -10;
      canvas.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    if (!reduceMotion) window.addEventListener("pointermove", onPointerMove);

    return () => {
      window.removeEventListener("resize", draw);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 h-full w-full transition-transform duration-700 ease-out"
    />
  );
}
