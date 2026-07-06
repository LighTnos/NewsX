"use client";

import { useEffect, useRef } from "react";

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
    let raf = 0;
    let px = 0;
    let py = 0;
    const onPointerMove = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const dx = (px / window.innerWidth - 0.5) * -10;
        const dy = (py / window.innerHeight - 0.5) * -10;
        canvas.style.transform = `translate(${dx}px, ${dy}px)`;
      });
    };
    if (!reduceMotion) window.addEventListener("pointermove", onPointerMove);

    return () => {
      window.removeEventListener("resize", draw);
      window.removeEventListener("pointermove", onPointerMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 h-full w-full"
    />
  );
}
