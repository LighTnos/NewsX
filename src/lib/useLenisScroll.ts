"use client";

import { useEffect, type RefObject } from "react";
import Lenis from "lenis";

export function useLenisScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    if (window.innerWidth < 768) {
      return;
    }

    const lenis = new Lenis({
      wrapper: el,
      content: el.firstElementChild ?? el,
      lerp: 0.06,
      smoothWheel: true,
      wheelMultiplier: 1.1,
    });

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, [ref]);
}
